import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/backend/lib/firebaseAdmin";
import { donationConfirmedEmail } from "@/backend/lib/emailTemplates";
import { getMailer } from "@/backend/lib/mailer";
import type { DonationLogEntry, DonationRequest } from "@/backend/types";

export const runtime = "nodejs";

/**
 * Finalizes a donation once BOTH sides have confirmed it happened.
 * Called by confirmDonation() in requests.ts, from either side, potentially
 * twice (once per confirmer) or even concurrently. Idempotent: if
 * donationVerified is already true, it just returns ok without redoing the
 * writes or resending email.
 *
 * All of this is done with the Admin SDK, which bypasses Firestore rules —
 * this is intentionally the ONLY place that writes into a profile that
 * doesn't belong to the caller, and it does so only after independently
 * verifying (server-side) that both confirmations are genuinely present on
 * the request itself.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));

    const { requestId } = await request.json();

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json(
        { error: "Missing requestId." },
        { status: 400 }
      );
    }

    const reqRef = adminDb.doc(`requests/${requestId}`);

    const result = await adminDb.runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);

      if (!reqSnap.exists) {
        throw new Error("Request not found.");
      }

      // Approved requests always have a donor (open requests get one when accepted).
      const req = {
        id: reqSnap.id,
        ...reqSnap.data(),
      } as DonationRequest & { donorUid: string; donorName: string };

      if (!req.donorUid) {
        throw new Error("This request hasn't been accepted by a donor yet.");
      }

      if (decoded.uid !== req.donorUid && decoded.uid !== req.requesterUid) {
        throw new Error("You're not part of this request.");
      }

      if (req.status !== "approved") {
        throw new Error("This request hasn't been approved yet.");
      }

      if (req.donationVerified) {
        return {
          verified: true,
          alreadyVerified: true,
          req,
        };
      }

      const confirmationField =
        decoded.uid === req.donorUid
          ? "donorConfirmedAt"
          : "requesterConfirmedAt";

      const now = Date.now();

      const donorConfirmed =
        Boolean(req.donorConfirmedAt) ||
        decoded.uid === req.donorUid;

      const requesterConfirmed =
        Boolean(req.requesterConfirmedAt) ||
        decoded.uid === req.requesterUid;

      // Was this confirmation field already set before this call? If so this
      // call is a no-op re-confirmation and shouldn't re-notify the other side.
      const isFirstConfirmationByThisSide = !req[confirmationField];

      // Read contact phone numbers now, before any writes — Firestore
      // transactions require all reads to precede all writes. Only needed
      // if this call is about to complete verification, but cheap either way.
      const [requesterContactSnap, donorContactSnap] = await Promise.all([
        tx.get(adminDb.doc(`requests/${req.id}/contacts/${req.requesterUid}`)),
        tx.get(adminDb.doc(`requests/${req.id}/contacts/${req.donorUid}`)),
      ]);

      tx.update(reqRef, {
        [confirmationField]: req[confirmationField] || now,
        updatedAt: now,
      });

      if (!donorConfirmed || !requesterConfirmed) {
        // Only one side has confirmed so far — tell the OTHER side they're
        // waited on, in-app, so they know to confirm too.
        if (isFirstConfirmationByThisSide) {
          const otherUid = decoded.uid === req.donorUid ? req.requesterUid : req.donorUid;
          const myName = decoded.uid === req.donorUid ? req.donorName : req.requesterName;
          tx.set(adminDb.collection("notifications").doc(), {
            uid: otherUid,
            title: "Confirm your donation",
            body: `${myName} marked your ${req.bloodType} donation as complete. Confirm it too to finish verifying it.`,
            tone: "info",
            read: false,
            createdAt: now,
            kind: "confirm-donation",
            requestId: req.id,
          });
        }
        return {
          verified: false,
          waitingOnOtherParty: true,
          req,
        };
      }

      // Phone numbers were published to requests/{id}/contacts/{uid} at
      // request time / approval time — already read above (transactions
      // require all reads before any writes), just extract them here.
      const requesterPhone = requesterContactSnap.exists
        ? ((requesterContactSnap.data() as { phone?: string })?.phone ?? null)
        : null;
      const donorPhone = donorContactSnap.exists
        ? ((donorContactSnap.data() as { phone?: string })?.phone ?? null)
        : null;

      const donorEntry: DonationLogEntry = {
        requestId: req.id,
        role: "donor",
        counterpartUid: req.requesterUid,
        counterpartName: req.requesterName,
        counterpartPhoto: req.requesterPhoto ?? null,
        counterpartPhone: requesterPhone,
        bloodType: req.bloodType,
        units: req.units,
        hospital: req.hospital,
        city: req.city,
        lat: req.lat,
        lng: req.lng,
        requestedAt: req.createdAt,
        acceptedAt: req.approvedAt,
        verifiedAt: now,
      };

      const requesterEntry: DonationLogEntry = {
        requestId: req.id,
        role: "requester",
        counterpartUid: req.donorUid,
        counterpartName: req.donorName,
        counterpartPhoto: req.donorPhoto ?? null,
        counterpartPhone: donorPhone,
        bloodType: req.bloodType,
        units: req.units,
        hospital: req.hospital,
        city: req.city,
        lat: req.lat,
        lng: req.lng,
        requestedAt: req.createdAt,
        acceptedAt: req.approvedAt,
        verifiedAt: now,
      };

      tx.update(reqRef, {
        donationVerified: true,
        donationVerifiedAt: now,
        updatedAt: now,
      });

      tx.set(
        adminDb.doc(`users/${req.donorUid}`),
        { donations: FieldValue.arrayUnion(donorEntry) },
        { merge: true }
      );

      tx.set(
        adminDb.doc(`users/${req.requesterUid}`),
        { donations: FieldValue.arrayUnion(requesterEntry) },
        { merge: true }
      );

      return {
        verified: true,
        newlyVerified: true,
        req,
        now,
      };
    });

    if (!result.verified || !result.newlyVerified) {
      return NextResponse.json({
        ok: true,
        verified: Boolean(result.verified),
        alreadyVerified: Boolean(result.alreadyVerified),
        waitingOnOtherParty: Boolean(result.waitingOnOtherParty),
      });
    }

    const req = result.req;

    // In-app notification to both sides that verification is complete,
    // with a link straight to their donation history.
    try {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
      const historyLink = appUrl ? `${appUrl}/profile#donation-history` : "/profile#donation-history";
      const now2 = Date.now();
      const batch = adminDb.batch();
      batch.set(adminDb.collection("notifications").doc(), {
        uid: req.donorUid,
        title: "Donation verified",
        body: `Your ${req.bloodType} donation with ${req.requesterName} is confirmed by both sides. View it: ${historyLink}`,
        tone: "success",
        read: false,
        createdAt: now2,
        kind: "history",
      });
      batch.set(adminDb.collection("notifications").doc(), {
        uid: req.requesterUid,
        title: "Donation verified",
        body: `Your ${req.bloodType} donation with ${req.donorName} is confirmed by both sides. View it: ${historyLink}`,
        tone: "success",
        read: false,
        createdAt: now2,
        kind: "history",
      });
      await batch.commit();
    } catch (e) {
      console.warn("Could not write donation-verified notifications:", e);
    }

    // Email notification remains best-effort.
    try {
      const mailer = getMailer();
      if (mailer) {
        const [donorUser, requesterUser] = await Promise.all([
          adminAuth.getUser(req.donorUid),
          adminAuth.getUser(req.requesterUid),
        ]);

        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
        const historyLink = appUrl ? `${appUrl}/profile#donation-history` : "/profile#donation-history";
        const date = new Date().toUTCString().slice(0, 16);

        const sends = [];
        if (donorUser.email) {
          const { subject, text, html } = donationConfirmedEmail({
            toName: req.donorName,
            counterpartName: req.requesterName,
            bloodType: req.bloodType,
            hospital: req.hospital,
            historyLink,
            date,
          });
          sends.push(mailer.transporter.sendMail({ from: mailer.from, to: donorUser.email, subject, text, html }));
        }
        if (requesterUser.email) {
          const { subject, text, html } = donationConfirmedEmail({
            toName: req.requesterName,
            counterpartName: req.donorName,
            bloodType: req.bloodType,
            hospital: req.hospital,
            historyLink,
            date,
          });
          sends.push(mailer.transporter.sendMail({ from: mailer.from, to: requesterUser.email, subject, text, html }));
        }

        await Promise.all(sends);
      }
    } catch (e) {
      console.warn(
        "Donation verified but email notification failed:",
        e
      );
    }

    return NextResponse.json({
      ok: true,
      verified: true,
    });
  } catch (err) {
    console.error(err);

    const message =
      err instanceof Error
        ? err.message
        : "Could not verify donation.";

    const status =
      message === "You're not part of this request."
        ? 403
        : message === "Request not found."
          ? 404
          : 400;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

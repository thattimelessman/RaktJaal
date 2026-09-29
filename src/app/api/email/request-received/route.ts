import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/backend/lib/firebaseAdmin";
import { requestReceivedEmail } from "@/backend/lib/emailTemplates";
import { getMailer } from "@/backend/lib/mailer";
import type { DonationRequest } from "@/backend/types";

export const runtime = "nodejs";

/**
 * Emails the donor when someone requests blood from them.
 * Called by the requester's client right after createDonationRequest().
 * Only the requester on that request may trigger it, and it only ever sends
 * once per request (guarded by requestEmailSentAt).
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));

    const { requestId } = await request.json();
    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json({ error: "Missing requestId." }, { status: 400 });
    }

    const ref = adminDb.doc(`requests/${requestId}`);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    const req = { id: snap.id, ...snap.data() } as DonationRequest & { requestEmailSentAt?: number };

    if (decoded.uid !== req.requesterUid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (req.requestEmailSentAt) return NextResponse.json({ ok: true, alreadySent: true });

    // Open (broadcast) requests aren't addressed to anyone, so there's no one to email.
    if (!req.donorUid) return NextResponse.json({ ok: true, skipped: "open-request" });

    const mailer = getMailer();
    if (!mailer) return NextResponse.json({ ok: true, skipped: "smtp-not-configured" });

    const donor = await adminAuth.getUser(req.donorUid);
    if (!donor.email) return NextResponse.json({ ok: true, skipped: "no-donor-email" });

    const { subject, text, html } = requestReceivedEmail({
      donorName: req.donorName ?? "there",
      requesterName: req.requesterName,
      bloodType: req.bloodType,
      units: req.units,
      hospital: req.hospital,
      city: req.city,
    });
    await mailer.transporter.sendMail({ from: mailer.from, to: donor.email, subject, text, html });
    await ref.update({ requestEmailSentAt: Date.now() });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    // Email is best-effort; never block the request flow.
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Could not send email." }, { status: 200 });
  }
}

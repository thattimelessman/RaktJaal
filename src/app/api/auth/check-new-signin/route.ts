import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/backend/lib/firebaseAdmin";
import { newSignInEmail } from "@/backend/lib/emailTemplates";
import { getMailer, safeDecode } from "@/backend/lib/mailer";

export const runtime = "nodejs";

/**
 * Called once per browser tab right after sign-in. Decides whether this is a
 * browser we haven't seen for this account and, if so, sends the "new sign-in
 * detected" email.
 *
 * Fingerprint = a random per-browser id the client keeps in localStorage. That
 * survives IP changes (mobile data, Wi-Fi <-> hotspot), which an IP-based
 * fingerprint would flag as "new" every time. If the client couldn't supply an
 * id we fall back to browser + OS + country. The IP is deliberately NOT part of it.
 *
 * Known fingerprints live in `userSecurity/{uid}` — a collection with no
 * Firestore rule, i.e. Admin-SDK only. The signed-in user cannot read or edit it
 * (unlike `users/{uid}`, which rules let them write freely).
 *
 * The very first sign-in we ever record for an account is silent, so existing
 * users don't get an alert the day this ships. Never blocks sign-in on failure.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));

    let deviceId: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.deviceId === "string" && /^[A-Za-z0-9-]{16,64}$/.test(body.deviceId)) {
        deviceId = body.deviceId;
      }
    } catch {
      /* no/invalid body — use the UA + country fallback */
    }

    const country = request.headers.get("x-vercel-ip-country") || "";
    const city = safeDecode(request.headers.get("x-vercel-ip-city"));
    const location = [city, country].filter(Boolean).join(", ") || "Unknown location";
    const device = simplifyUserAgent(request.headers.get("user-agent") || "");
    const fingerprint = deviceId ? `id:${deviceId}` : `ua:${device}|${country}`;

    const secRef = adminDb.doc(`userSecurity/${decoded.uid}`);
    // Transaction so two tabs signing in at once can't both decide "new" and double-email.
    const { isNew, isFirstEver } = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(secRef);
      const known: string[] = Array.isArray(snap.data()?.knownDeviceFingerprints)
        ? snap.data()!.knownDeviceFingerprints
        : [];
      if (known.includes(fingerprint)) return { isNew: false, isFirstEver: false };
      tx.set(secRef, { knownDeviceFingerprints: [...known, fingerprint].slice(-10) }, { merge: true });
      return { isNew: true, isFirstEver: known.length === 0 };
    });

    if (isNew && !isFirstEver) {
      try {
        const mailer = getMailer();
        const user = await adminAuth.getUser(decoded.uid);
        if (mailer && user.email) {
          const profile = (await adminDb.doc(`users/${decoded.uid}`).get()).data() || {};
          const time = new Date().toUTCString().replace("GMT", "UTC");
          const { subject, text, html } = newSignInEmail({
            name: profile.name || user.displayName || "there",
            device,
            location,
            time,
          });
          await mailer.transporter.sendMail({ from: mailer.from, to: user.email, subject, text, html });
        }
      } catch (e) {
        console.warn("New sign-in detected but alert email failed:", e);
      }
    }

    return NextResponse.json({ ok: true, newDevice: isNew && !isFirstEver });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

function simplifyUserAgent(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "an unknown OS";
  return `${browser} on ${os}`;
}

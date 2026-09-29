import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/backend/lib/firebaseAdmin";
import { verifyEmailOtp } from "@/backend/lib/emailOtp";
import { welcomeEmail } from "@/backend/lib/emailTemplates";
import { getMailer } from "@/backend/lib/mailer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    const { purpose, code } = await request.json();
    if (purpose !== "registration" && purpose !== "delete" && purpose !== "twofactor") {
      return NextResponse.json({ error: "Invalid OTP purpose" }, { status: 400 });
    }
    if (!/^\d{6}$/.test(String(code || ""))) return NextResponse.json({ error: "Enter the 6-digit OTP." }, { status: 400 });

    const user = await adminAuth.getUser(decoded.uid);
    if (!user.email) return NextResponse.json({ error: "No email address is available for this account." }, { status: 400 });
    await verifyEmailOtp(user.uid, user.email, purpose, String(code));

    if (purpose === "registration") {
      await adminAuth.updateUser(user.uid, { emailVerified: true });

      // Welcome email — once per user, best-effort (never fails verification).
      try {
        const userRef = adminDb.doc(`users/${user.uid}`);
        const profileSnap = await userRef.get();
        const profile = profileSnap.data() || {};
        const mailer = getMailer();
        if (mailer && !profile.welcomeEmailSentAt) {
          const { subject, text, html } = welcomeEmail({ name: profile.name || user.displayName || "there" });
          await mailer.transporter.sendMail({ from: mailer.from, to: user.email, subject, text, html });
          await userRef.set({ welcomeEmailSentAt: Date.now() }, { merge: true });
        }
      } catch (e) {
        console.warn("Verified, but welcome email failed:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not verify OTP." }, { status: 400 });
  }
}

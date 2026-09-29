import { NextResponse } from "next/server";
import { adminAuth } from "@/backend/lib/firebaseAdmin";
import { passwordChangedEmail } from "@/backend/lib/emailTemplates";
import { getMailer } from "@/backend/lib/mailer";

export const runtime = "nodejs";

/** Best-effort security notice sent right after a password change from the profile page. */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));

    const mailer = getMailer();
    if (!mailer) return NextResponse.json({ ok: true, skipped: "smtp-not-configured" });

    const user = await adminAuth.getUser(decoded.uid);
    if (!user.email) return NextResponse.json({ ok: true, skipped: "no-email" });

    const { subject, text, html } = passwordChangedEmail({
      name: user.displayName || "there",
      time: new Date().toUTCString().replace("GMT", "UTC"),
    });
    await mailer.transporter.sendMail({ from: mailer.from, to: user.email, subject, text, html });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Could not send email." }, { status: 200 });
  }
}

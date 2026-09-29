import { NextResponse } from "next/server";
import { adminAuth } from "@/backend/lib/firebaseAdmin";
import { bloodTypeChangedEmail } from "@/backend/lib/emailTemplates";
import { getMailer } from "@/backend/lib/mailer";
import { siteUrl, profileName } from "@/backend/lib/siteUrl";

export const runtime = "nodejs";

/** Best-effort notice sent right after a profile blood-type edit. */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));

    const { oldType, newType } = await request.json();
    if (!newType || typeof newType !== "string") {
      return NextResponse.json({ error: "Missing newType." }, { status: 400 });
    }

    const mailer = getMailer();
    if (!mailer) return NextResponse.json({ ok: true, skipped: "smtp-not-configured" });

    const user = await adminAuth.getUser(decoded.uid);
    if (!user.email) return NextResponse.json({ ok: true, skipped: "no-email" });

    const { subject, text, html } = bloodTypeChangedEmail({
      name: await profileName(user.uid, user.displayName),
      oldType: oldType || "—",
      newType,
    });
    await mailer.transporter.sendMail({ from: mailer.from, to: user.email, subject, text, html });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Could not send email." }, { status: 200 });
  }
}

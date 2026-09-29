import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/backend/lib/firebaseAdmin";
import { passwordResetEmail } from "@/backend/lib/emailTemplates";
import { getMailer } from "@/backend/lib/mailer";
import { siteUrl, profileName } from "@/backend/lib/siteUrl";

export const runtime = "nodejs";

/**
 * Custom password-reset email, sent through our own SMTP + Macaly-style
 * template instead of Firebase's default reset email (which the client SDK
 * cannot restyle). Uses the Admin SDK to generate the same kind of reset
 * link Firebase itself would use; clicking it lands on Firebase's hosted
 * action handler (or a custom one, if ACTION_URL is configured) and works
 * exactly like the built-in flow — only the email around it is ours.
 *
 * No email-enumeration leak: always returns { ok: true } whether or not the
 * address is registered, and only actually sends when it is.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Enter your email address." }, { status: 400 });
    }

    let user;
    try {
      user = await adminAuth.getUserByEmail(email.toLowerCase().trim());
    } catch {
      // Unknown email — say ok anyway so this endpoint can't be used to
      // probe which addresses are registered.
      return NextResponse.json({ ok: true });
    }

    const hasPassword = user.providerData.some((p) => p.providerId === "password");
    if (!hasPassword) {
      // Google-only account — nothing to reset. Still say ok (same reason as above).
      return NextResponse.json({ ok: true });
    }

    // This endpoint is unauthenticated, so without a cooldown anyone could use it
    // to spam a registered address. One reset email per account per minute; extra
    // calls still answer ok so nothing about the account leaks.
    const secRef = adminDb.doc(`userSecurity/${user.uid}`);
    const last = (await secRef.get()).data()?.lastResetEmailAt;
    if (typeof last === "number" && Date.now() - last < 60_000) {
      return NextResponse.json({ ok: true });
    }
    await secRef.set({ lastResetEmailAt: Date.now() }, { merge: true });

    const base = siteUrl();
    const actionCodeSettings = base ? { url: `${base}/login` } : undefined;
    const resetLink = await adminAuth.generatePasswordResetLink(user.email!, actionCodeSettings);

    const mailer = getMailer();
    if (mailer) {
      const { subject, text, html } = passwordResetEmail({
        name: await profileName(user.uid, user.displayName),
        resetLink,
      });
      await mailer.transporter.sendMail({ from: mailer.from, to: user.email!, subject, text, html });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    // Still don't leak details to the client.
    return NextResponse.json({ ok: true });
  }
}

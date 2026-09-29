import { NextResponse } from "next/server";
import { adminAuth } from "@/backend/lib/firebaseAdmin";
import { createEmailOtp } from "@/backend/lib/emailOtp";
import { otpEmail } from "@/backend/lib/emailTemplates";
import { getMailer, safeDecode } from "@/backend/lib/mailer";
import { renderOtpHero } from "@/backend/lib/otpHero";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    const { purpose } = await request.json();
    if (purpose !== "registration" && purpose !== "delete" && purpose !== "twofactor") {
      return NextResponse.json({ error: "Invalid OTP purpose" }, { status: 400 });
    }

    const user = await adminAuth.getUser(decoded.uid);
    if (!user.email) return NextResponse.json({ error: "No email address is available for this account." }, { status: 400 });
    const code = await createEmailOtp(user.uid, user.email, purpose);

    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || undefined;
    const city = request.headers.get("x-vercel-ip-city");
    const country = request.headers.get("x-vercel-ip-country");
    const location = [safeDecode(city), country].filter(Boolean).join(", ") || undefined;
    const time = new Date().toUTCString().replace("GMT", "UTC");

    const mailer = getMailer();
    if (!mailer) {
      return NextResponse.json(
        { error: "Email OTP is not configured. Check your Gmail SMTP settings." },
        { status: 500 }
      );
    }

    const { subject, text, html } = otpEmail({ code, purpose, ip, location, time });
    // Hero illustration with THIS code drawn into its boxes (null => static fallback).
    const heroPng = await renderOtpHero(code);
    await mailer.transporter.sendMail({
      from: mailer.from,
      to: user.email,
      subject,
      text,
      html,
      attachments: heroPng
        ? [{ filename: "rj-hero-otp.png", content: heroPng, cid: "rj-hero-otp", contentType: "image/png", contentDisposition: "inline" }]
        : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not send OTP." }, { status: 500 });
  }
}

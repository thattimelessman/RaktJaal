import { NextResponse } from "next/server";
import { adminAuth } from "@/backend/lib/firebaseAdmin";
import { createEmailOtp } from "@/backend/lib/emailOtp";
import nodemailer from "nodemailer";

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

    const subject =
      purpose === "registration"
        ? "RaktJaal email verification OTP"
        : purpose === "delete"
        ? "RaktJaal account deletion OTP"
        : "RaktJaal two-step verification OTP";
    const heading =
      purpose === "registration"
        ? "Verify your RaktJaal account"
        : purpose === "delete"
        ? "Confirm RaktJaal account deletion"
        : "Enable two-step verification";
    const text = `Your RaktJaal OTP is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`;
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${heading}</h2><p>Your one-time password is:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</div><p>This OTP expires in 10 minutes.</p><p>If you did not request this code, you can ignore this email.</p></div>`;

    const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;

if (!smtpUser || !smtpPassword) {
  return NextResponse.json(
    { error: "Email OTP is not configured. Check your Gmail SMTP settings." },
    { status: 500 }
  );
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: smtpUser,
    pass: smtpPassword,
  },
});

await transporter.sendMail({
  from: `"RaktJaal" <${smtpUser}>`,
  to: user.email,
  subject,
  text,
  html,
});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not send OTP." }, { status: 500 });
  }
}

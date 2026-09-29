import nodemailer from "nodemailer";

/** Returns a configured transporter + from-address, or null when SMTP isn't set up. */
export function getMailer() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return {
    from: `"RaktJaal" <${user}>`,
    transporter: nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      // 465 = implicit TLS. 587/25 use STARTTLS, which nodemailer negotiates
      // itself when `secure` is false — forcing `true` there breaks the connection.
      secure: port === 465,
      auth: { user, pass },
    }),
  };
}

/** decodeURIComponent that never throws — proxy geo headers can carry odd bytes,
 *  and a throw here would otherwise fail the whole request (e.g. the OTP send). */
export function safeDecode(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

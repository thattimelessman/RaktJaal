import nodemailer from "nodemailer";
import { EMAIL_ASSETS } from "@/backend/lib/emailAssets";

/** Returns a configured transporter + from-address, or null when SMTP isn't set up. */
export function getMailer() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    // 465 = implicit TLS. 587/25 use STARTTLS, which nodemailer negotiates
    // itself when `secure` is false — forcing `true` there breaks the connection.
    secure: port === 465,
    auth: { user, pass },
  });

  // Every send goes through this transporter, so this one hook covers all emails:
  // any <img src="cid:rj-..."> in the html gets its PNG attached inline. Images are
  // then part of the message itself — no remote URL to break, block, or 404.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transporter.use("compile", (mail: any, done: (err?: Error | null) => void) => {
    const html = typeof mail.data.html === "string" ? mail.data.html : "";
    const used = Object.keys(EMAIL_ASSETS).filter((id) => html.includes(`cid:${id}"`));
    if (used.length) {
      mail.data.attachments = [
        ...(mail.data.attachments || []),
        ...used.map((id) => ({
          filename: `${id}.png`,
          content: Buffer.from(EMAIL_ASSETS[id], "base64"),
          cid: id,
          contentType: "image/png",
          contentDisposition: "inline",
        })),
      ];
    }
    done();
  });

  return { from: `"RaktJaal" <${user}>`, transporter };
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

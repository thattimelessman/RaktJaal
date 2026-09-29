/**
 * RaktJaal transactional emails — Macaly card style.
 * Grey page background, centered white rounded card, logo + wordmark header,
 * serif heading, illustrated hero panel, centered body copy, dark pill CTA,
 * light footer with unsubscribe-style legal line.
 *
 * Images (public/email/logo.png and hero/*.png) are NOT loaded from a URL. They are
 * embedded in each message as inline cid: attachments — see emailAssets.ts (generated
 * by scripts/gen-email-assets.mjs) and the hook in mailer.ts. Re-run that script after
 * editing any of those PNGs.
 *
 * Usage:
 *   import { otpEmail } from "@/backend/lib/emailTemplates";
 *   const { subject, text, html } = otpEmail({ code, purpose, ip, location, time });
 */

const RED = "#D6303F";
const INK = "#111111";
const MUTED = "#767676";
const PAGE_BG = "#F3F3F3";

// Heading typeface. Email clients can't load web fonts reliably (Gmail ignores
// @font-face), so this is a system stack: refined serif where available, sane fallbacks.
// To try a modern sans instead, use:
//   "-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"  with weight 700
const HEADING_FONT = "Georgia,'Iowan Old Style','Palatino Linotype',Palatino,'Times New Roman',serif";
const HEADING_WEIGHT = 400;

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

/* ---------- shell ---------- */

function shell(opts: {
  hero: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaGhost?: boolean;
  footerNote?: string;
  preheader?: string;
}) {
  const year = new Date().getFullYear();
  const cta =
    opts.ctaLabel && opts.ctaHref
      ? `<tr><td align="center" style="padding:22px 0 4px;">
          <a href="${esc(opts.ctaHref)}" style="display:inline-block;${
          opts.ctaGhost
            ? `background:#ffffff;color:${INK};border:1.5px solid ${INK};`
            : `background:${INK};color:#ffffff;border:1.5px solid ${INK};`
        }font-size:14px;font-weight:700;text-decoration:none;padding:13px 30px;border-radius:999px;">${esc(
          opts.ctaLabel
        )}</a></td></tr>`
      : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAGE_BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader || "")}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAGE_BG};">
<tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;font-family:Georgia,'Times New Roman',serif;">

    <tr><td align="center" style="padding:36px 24px 22px;">
      <table role="presentation" cellspacing="0" cellpadding="0"><tr>
        <td style="padding-right:9px;"><img src="cid:rj-logo" width="30" height="30" alt="" style="display:block;border:0;border-radius:50%;width:30px;height:30px;"/></td>
        <td style="font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:700;color:${INK};letter-spacing:0.2px;">RaktJaal</td>
      </tr></table>
    </td></tr>

    <tr><td align="center" style="padding:0 28px 26px;font-family:${HEADING_FONT};font-size:32px;line-height:1.2;font-weight:${HEADING_WEIGHT};letter-spacing:-0.6px;color:${INK};">
      ${opts.heading}
    </td></tr>

    <tr><td align="center" style="padding:0 22px;">
      <img src="cid:rj-hero-${opts.hero}" width="516" alt=""
        style="display:block;border:0;width:100%;max-width:516px;height:auto;border-radius:18px;"/>
    </td></tr>

    <tr><td style="padding:26px 40px 4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${INK};text-align:center;">
      ${opts.body}
    </td></tr>

    ${cta}

    <tr><td style="padding:30px 40px 8px;">
      <div style="border-top:1px solid #ececec;"></div>
    </td></tr>
    <tr><td align="center" style="padding:0 40px 34px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:${MUTED};">
      ${opts.footerNote || "You received this email because you have a RaktJaal account."}<br/>
      © ${year} RaktJaal
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 12px;">${t}</p>`;
const b = (t: string) => `<b style="color:${INK};">${esc(t)}</b>`;

/* ================= 1. Registration welcome ================= */

export function welcomeEmail(o: { name: string }) {
  const url = appUrl() || "#";
  return {
    subject: `Welcome to RaktJaal, ${o.name}`,
    text: `Welcome to RaktJaal, ${o.name}.\n\nYour account is ready. Set your blood group and city, then turn on availability so nearby requests can reach you.\n\nOpen RaktJaal: ${url}/profile`,
    html: shell({
      hero: "welcome",
      heading: `Welcome to RaktJaal,<br/>${esc(o.name)}`,
      body:
        p(`Your account is ready. RaktJaal connects people who need blood with donors nearby and every donor on it matters.`) +
        p(`Set your blood group and city, then turn on availability so requests near you can find you.`),
      ctaLabel: "Complete your profile",
      ctaHref: `${url}/profile`,
      preheader: "Your RaktJaal account is ready.",
    }),
  };
}

/* ================= 2. Account deleted ================= */

export function accountDeletedEmail(o: { name: string }) {
  const url = appUrl() || "#";
  return {
    subject: "Your RaktJaal account has been deleted",
    text: `Hi ${o.name}, your RaktJaal account and profile data have been permanently deleted. If you didn't do this, reply to this email immediately.`,
    html: shell({
      hero: "deleted",
      heading: "Your account has<br/>been deleted",
      body:
        p(`Hi ${esc(o.name)}, your profile and donation history have been permanently removed from RaktJaal.`) +
        p(`Thank you for the time you spent with us. You're always welcome to sign up again.`) +
        p(`<span style="color:${MUTED};font-size:13px;">Didn't do this? Reply to this email right away.</span>`),
      ctaLabel: "Visit RaktJaal",
      ctaHref: url || "#",
      ctaGhost: true,
      preheader: "Your RaktJaal account was deleted.",
    }),
  };
}

/* ================= 3. 2FA OTP ================= */

export type OtpPurpose = "registration" | "delete" | "twofactor" | "disable2fa";

const OTP_COPY: Record<OtpPurpose, { subject: string; heading: string; lead: string }> = {
  registration: { subject: "is your RaktJaal verification code", heading: "Verify your email", lead: "Enter this code to verify your email address." },
  twofactor: { subject: "is your RaktJaal two-step code", heading: "Two-step verification", lead: "Enter this code to finish signing in." },
  disable2fa: { subject: "is your code to turn off two-step verification", heading: "Turn off two-step?", lead: "Enter this code to confirm you want to turn off two-step verification. If this wasn't you, don't share it — change your password instead." },
  delete: { subject: "is your RaktJaal deletion code", heading: "Confirm account deletion", lead: "Enter this code to permanently delete your account." },
};

export function otpEmail(o: { code: string; purpose: OtpPurpose; ip?: string; location?: string; time?: string }) {
  const c = OTP_COPY[o.purpose];
  const when = o.time || new Date().toUTCString();
  const origin = o.ip || o.location ? `${esc([o.ip, o.location].filter(Boolean).join(", "))} at ${esc(when)}` : esc(when);
  return {
    subject: `${o.code} ${c.subject}`,
    text: `${c.heading}\n\n${c.lead}\n\n${o.code}\n\nRequested from ${origin}. If this wasn't you, ignore this email.`,
    html: shell({
      hero: "otp",
      heading: c.heading,
      body:
        p(c.lead) +
        `<div style="margin:6px 0 22px;"><span style="display:inline-block;background:${PAGE_BG};border-radius:14px;padding:16px 26px 16px 34px;font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:34px;line-height:1;font-weight:700;letter-spacing:8px;color:${INK};">${esc(o.code)}</span></div>` +
        `<p style="margin:-10px 0 16px;font-size:12px;color:${MUTED};">Tip: double-click (or long-press) the code to copy it.</p>` +
        p(`<span style="font-size:12px;color:${MUTED};">Requested from ${origin}. Didn't request this? You can safely ignore this email — the code expires in 10 minutes.</span>`),
      preheader: `${o.code} ${c.subject}`,
    }),
  };
}

/* ================= 4. Donation confirmed / verified ================= */

export function donationConfirmedEmail(o: {
  toName: string;
  counterpartName: string;
  bloodType: string;
  hospital: string;
  historyLink: string;
  date?: string;
}) {
  return {
    subject: "Donation confirmed on RaktJaal",
    text: `Hi ${o.toName}, your ${o.bloodType} donation with ${o.counterpartName} at ${o.hospital} has been confirmed by both sides.\n\nView it: ${o.historyLink}`,
    html: shell({
      hero: "donation",
      heading: "Donation verified",
      body:
        p(`Hi ${esc(o.toName)}, both sides have confirmed this donation with ${b(o.counterpartName)}. Thank you.`) +
        p(`<span style="color:${MUTED};font-size:13px;">${esc(o.bloodType)} · ${esc(o.hospital)} · ${esc(o.date || new Date().toUTCString().slice(0, 16))}</span>`) +
        p(`Every donation like this can save Priceless lives.`),
      ctaLabel: "View donation history",
      ctaHref: o.historyLink,
      preheader: `Your ${o.bloodType} donation was confirmed.`,
    }),
  };
}

/* ================= 5. Password reset ================= */

export function passwordResetEmail(o: { name: string; resetLink: string }) {
  return {
    subject: "Reset your RaktJaal password",
    text: `Hi ${o.name}, use the link below to reset your password. This link expires in 30 minutes.\n\n${o.resetLink}\n\nIf you didn't request this, you can ignore this email.`,
    html: shell({
      hero: "reset",
      heading: "Reset your password",
      body:
        p(`Hi ${esc(o.name)}, click below to choose a new password for your account.`) +
        p(`<span style="font-size:12px;color:${MUTED};">This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</span>`),
      ctaLabel: "Reset password",
      ctaHref: o.resetLink,
      preheader: "Reset your RaktJaal password.",
    }),
  };
}

/* ================= 6. Blood request received / urgent alert ================= */

export function requestReceivedEmail(o: {
  donorName: string;
  requesterName: string;
  bloodType: string;
  units: number | string;
  hospital: string;
  city: string;
  note?: string;
}) {
  const url = appUrl() || "#";
  return {
    subject: `${o.requesterName} needs ${o.bloodType} blood`,
    text: `Hi ${o.donorName}, ${o.requesterName} requested ${o.units} unit(s) of ${o.bloodType} at ${o.hospital}, ${o.city}.\n\nView: ${url}/action`,
    html: shell({
      hero: "request",
      heading: "Someone needs<br/>your help",
      body:
        p(`Hi ${esc(o.donorName)}, ${b(o.requesterName)} has requested ${b(String(o.units))} unit(s) of ${b(o.bloodType)} at ${esc(o.hospital)}, ${esc(o.city)}.`) +
        (o.note ? p(`<span style="color:${MUTED};font-size:13px;">"${esc(o.note)}"</span>`) : "") +
        p(`Their contact details are shared with you only if you accept.`),
      ctaLabel: "View request",
      ctaHref: `${url}/action`,
      preheader: `${o.requesterName} needs ${o.bloodType} blood at ${o.hospital}.`,
    }),
  };
}

/* ================= 7. Blood group changed ================= */

export function bloodTypeChangedEmail(o: { name: string; oldType: string; newType: string }) {
  const url = appUrl() || "#";
  return {
    subject: "Your blood group was updated",
    text: `Hi ${o.name}, your blood group on RaktJaal was changed from ${o.oldType} to ${o.newType}. If this wasn't you, please review your profile.`,
    html: shell({
      hero: "bloodtype",
      heading: "Blood group updated",
      body:
        p(`Hi ${esc(o.name)}, your profile blood group was changed from ${b(o.oldType)} to ${b(o.newType)}.`) +
        p(`<span style="font-size:12px;color:${MUTED};">Didn't make this change? Review your profile right away.</span>`),
      ctaLabel: "View profile",
      ctaHref: `${url}/profile`,
      preheader: `Blood group updated to ${o.newType}.`,
    }),
  };
}

/* ================= Password changed ================= */

export function passwordChangedEmail(o: { name: string; time: string }) {
  const url = appUrl() || "#";
  return {
    subject: "Your RaktJaal password was changed",
    text: `Hi ${o.name}, the password on your RaktJaal account was changed on ${o.time}. If this wasn't you, reset your password immediately: ${url}/login`,
    html: shell({
      hero: "security",
      heading: "Password changed",
      body:
        p(`Hi ${esc(o.name)}, the password on your RaktJaal account was just changed.`) +
        p(`<span style="font-size:12px;color:${MUTED};">${esc(o.time)}. If this was you, no action is needed. If not, reset your password right away and turn on two-step verification.</span>`),
      ctaLabel: "Secure my account",
      ctaHref: `${url}/profile`,
      preheader: "Your RaktJaal password was changed.",
    }),
  };
}

/* ================= 8. New sign-in device / location ================= */

export function newSignInEmail(o: { name: string; device: string; location: string; time: string }) {
  const url = appUrl() || "#";
  return {
    subject: "New sign-in to your RaktJaal account",
    text: `Hi ${o.name}, a new sign-in was detected from ${o.device}, ${o.location} at ${o.time}. If this wasn't you, secure your account immediately.`,
    html: shell({
      hero: "newsignin",
      heading: "New sign-in detected",
      body:
        p(`Hi ${esc(o.name)}, your account was just accessed from ${b(o.device)} in ${b(o.location)}.`) +
        p(`<span style="font-size:12px;color:${MUTED};">${esc(o.time)}. If this was you, no action is needed.</span>`),
      ctaLabel: "Secure my account",
      ctaHref: `${url}/settings/security`,
      preheader: "A new device signed in to your account.",
    }),
  };
}

/* ================= 9. Security policy update (rare) ================= */

export function securityPolicyEmail(o: { name: string; effectiveDate: string; summary: string; policyLink: string }) {
  return {
    subject: "An update to RaktJaal's security policy",
    text: `Hi ${o.name}, we've updated our security policy, effective ${o.effectiveDate}.\n\n${o.summary}\n\nRead the full update: ${o.policyLink}`,
    html: shell({
      hero: "security",
      heading: "A quick policy update",
      body:
        p(`Hi ${esc(o.name)}, we've updated how RaktJaal protects your account, effective ${b(o.effectiveDate)}.`) +
        p(`<span style="color:${MUTED};font-size:13px;">${esc(o.summary)}</span>`),
      ctaLabel: "Read the update",
      ctaHref: o.policyLink,
      ctaGhost: true,
      footerNote: "You're receiving this because it's a required update to your account terms.",
      preheader: "RaktJaal's security policy has been updated.",
    }),
  };
}

/* ================= 10. New feature announcement (rare) ================= */

export function newFeatureEmail(o: { name: string; featureName: string; description: string; link: string }) {
  return {
    subject: `New on RaktJaal: ${o.featureName}`,
    text: `Hi ${o.name}, ${o.featureName} is now live on RaktJaal.\n\n${o.description}\n\n${o.link}`,
    html: shell({
      hero: "feature",
      heading: "Something new<br/>just landed",
      body:
        p(`Hi ${esc(o.name)}, ${b(o.featureName)} is now live on RaktJaal.`) +
        p(`<span style="color:${MUTED};font-size:13px;">${esc(o.description)}</span>`),
      ctaLabel: "See what's new",
      ctaHref: o.link,
      ctaGhost: true,
      footerNote: "You can turn off feature announcements anytime in settings.",
      preheader: `${o.featureName} is now live.`,
    }),
  };
}
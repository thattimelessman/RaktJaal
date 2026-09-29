import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { adminAuth, adminDb } from "@/backend/lib/firebaseAdmin";
import { securityPolicyEmail, newFeatureEmail } from "@/backend/lib/emailTemplates";
import { getMailer } from "@/backend/lib/mailer";

export const runtime = "nodejs";
// Sends are sequential, so a big list needs headroom on serverless hosts
// (capped by your plan's limit). Gmail SMTP also caps daily sends (~500/day).
export const maxDuration = 300;

const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const secretMatches = (given: unknown, expected: string) => {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Manual, rare broadcast to every user: a security policy update or a new
 * feature announcement. Not wired to any UI button — call it yourself
 * (curl / Postman / a one-off script) when you actually have one of these
 * to send. Gated by ADMIN_BROADCAST_SECRET so it can't be hit by anyone
 * who doesn't have that value.
 *
 * Body:
 *   { type: "security", secret, effectiveDate, summary, policyLink }
 *   { type: "feature",  secret, featureName, description, link }
 * Add `dryRun: true` to either to only count recipients without sending.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const secret = process.env.ADMIN_BROADCAST_SECRET;
    if (!secret || !secretMatches(body.secret, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate BEFORE touching any recipient: a missing field would otherwise
    // render as "undefined" in an email that goes to every user, unrecallably.
    const valid =
      body.type === "security"
        ? str(body.effectiveDate) && str(body.summary) && str(body.policyLink)
        : body.type === "feature"
        ? str(body.featureName) && str(body.description) && str(body.link)
        : false;
    if (!valid) {
      return NextResponse.json({ error: "Invalid type or missing fields for that type." }, { status: 400 });
    }

    const mailer = getMailer();
    if (!mailer) return NextResponse.json({ error: "SMTP is not configured." }, { status: 500 });

    // Firestore users collection is the source of truth for who to email —
    // Admin Auth's listUsers is paged separately, so pull emails from there
    // in batches (this is a low-frequency, manual operation; simplicity
    // over throughput is the right tradeoff here).
    const recipients: { email: string; name: string }[] = [];
    let pageToken: string | undefined;
    do {
      const page = await adminAuth.listUsers(1000, pageToken);
      for (const u of page.users) {
        if (u.email) recipients.push({ email: u.email, name: u.displayName || "there" });
      }
      pageToken = page.pageToken;
    } while (pageToken);

    if (body.dryRun) return NextResponse.json({ ok: true, dryRun: true, total: recipients.length });

    let sent = 0;
    for (const r of recipients) {
      try {
        const mail =
          body.type === "security"
            ? securityPolicyEmail({
                name: r.name,
                effectiveDate: body.effectiveDate,
                summary: body.summary,
                policyLink: body.policyLink,
              })
            : body.type === "feature"
            ? newFeatureEmail({
                name: r.name,
                featureName: body.featureName,
                description: body.description,
                link: body.link,
              })
            : null;
        if (!mail) return NextResponse.json({ error: "Invalid type." }, { status: 400 });
        await mailer.transporter.sendMail({ from: mailer.from, to: r.email, subject: mail.subject, text: mail.text, html: mail.html });
        sent++;
      } catch (e) {
        console.warn(`Broadcast failed for ${r.email}:`, e);
      }
    }

    return NextResponse.json({ ok: true, sent, total: recipients.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Broadcast failed." }, { status: 500 });
  }
}

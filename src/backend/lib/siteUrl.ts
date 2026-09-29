import { adminDb } from "@/backend/lib/firebaseAdmin";

/**
 * Public base URL used in email buttons. Prefers NEXT_PUBLIC_APP_URL, then
 * Vercel's own env vars, so links still work if the variable was never set.
 * (An unset URL used to render buttons as "#", which do nothing.)
 */
export function siteUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (explicit) return /^https?:\/\//.test(explicit) ? explicit : `https://${explicit}`;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "";
}

/**
 * The name to greet someone by in emails: the RaktJaal profile name, NOT the
 * Firebase Auth displayName (which for Google sign-ins is their Google name).
 */
export async function profileName(uid: string, fallback?: string | null): Promise<string> {
  try {
    const snap = await adminDb.doc(`users/${uid}`).get();
    const n = snap.data()?.name;
    if (typeof n === "string" && n.trim()) return n.trim();
  } catch {
    /* fall through */
  }
  return fallback || "there";
}

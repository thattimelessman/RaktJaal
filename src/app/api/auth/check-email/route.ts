import { NextResponse } from "next/server";
import { adminAuth } from "@/backend/lib/firebaseAdmin";

export const runtime = "nodejs";

/**
 * POST /api/auth/check-email  { email: string }
 * -> { exists: boolean, providers: string[] }
 *
 * Why this exists: Firebase "email enumeration protection" (on by default for
 * newer projects) makes the client SDK return the same `auth/invalid-credential`
 * error whether the email is unregistered OR the password is wrong. The client
 * therefore can't tell the two apart. The Admin SDK isn't subject to that, so we
 * ask it directly, but only after a failed login attempt, so we never expose a
 * general-purpose "is this email registered?" probe on page load.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    try {
      const user = await adminAuth.getUserByEmail(email);
      return NextResponse.json({
        exists: true,
        providers: user.providerData.map((p) => p.providerId),
      });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/user-not-found") {
        return NextResponse.json({ exists: false, providers: [] });
      }
      throw err;
    }
  } catch (err) {
    console.error("check-email failed:", err);
    // On any unexpected failure the client falls back to the generic message.
    return NextResponse.json({ error: "Could not check email." }, { status: 500 });
  }
}
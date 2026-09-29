import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/backend/lib/firebaseAdmin";
import { verifyEmailOtp } from "@/backend/lib/emailOtp";

export const runtime = "nodejs";

/**
 * Turns two-step verification OFF, but only after the account owner proves
 * they can read their email by entering a fresh OTP (purpose "disable2fa").
 * Firestore rules stop the client from clearing twoFactorEnabled itself, so
 * this route (Admin SDK) is the only way to opt out.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    const { code } = await request.json();
    if (!/^\d{6}$/.test(String(code || ""))) return NextResponse.json({ error: "Enter the 6-digit OTP." }, { status: 400 });

    const user = await adminAuth.getUser(decoded.uid);
    if (!user.email) return NextResponse.json({ error: "No email address is available for this account." }, { status: 400 });
    await verifyEmailOtp(user.uid, user.email, "disable2fa", String(code));

    await adminDb.doc(`users/${user.uid}`).set({ twoFactorEnabled: false, updatedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not turn off two-step verification." }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/backend/lib/firebaseAdmin";
import { verifyEmailOtp } from "@/backend/lib/emailOtp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    const { code } = await request.json();
    if (!/^\d{6}$/.test(String(code || ""))) return NextResponse.json({ error: "Enter the 6-digit OTP." }, { status: 400 });
    const user = await adminAuth.getUser(decoded.uid);
    if (!user.email) return NextResponse.json({ error: "No email address is available for this account." }, { status: 400 });
    await verifyEmailOtp(user.uid, user.email, "delete", String(code));

    // Delete the Auth user first: it is the source of truth for "is this email registered?".
    // If this throws, nothing else has been touched and the user can simply retry.
    await adminAuth.deleteUser(user.uid);

    // Best-effort cleanup of the profile doc and any leftover OTP docs.
    // The account is already gone at this point, so failures here must not fail the request.
    await Promise.allSettled([
      adminDb.collection("users").doc(user.uid).delete(),
      adminDb.collection("emailOtps").doc(`registration_${user.uid}`).delete(),
      adminDb.collection("emailOtps").doc(`delete_${user.uid}`).delete(),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not delete the account." }, { status: 400 });
  }
}
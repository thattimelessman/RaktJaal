import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { adminAuth, adminDb } from "@/backend/lib/firebaseAdmin";

export const runtime = "nodejs";

const secretMatches = (given: unknown, expected: string) => {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Admin-only: lets ONE user re-select their blood type after they emailed
 * raktjaal@gmail.com with proof. Not wired to any UI; call it yourself
 * (curl / Postman) once you've verified the request.
 *
 *   { secret, email }                -> unlock
 *   { secret, email, lock: true }    -> re-lock without a change
 *
 * The user's profile then shows the blood-type picker once; saving a new
 * value locks it again automatically.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const secret = process.env.ADMIN_BROADCAST_SECRET;
    if (!secret || !secretMatches(body.secret, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      return NextResponse.json({ error: "Missing email." }, { status: 400 });
    }

    const user = await adminAuth.getUserByEmail(body.email.trim().toLowerCase());
    const unlock = body.lock !== true;
    await adminDb.doc(`users/${user.uid}`).set({ bloodTypeUnlocked: unlock, updatedAt: Date.now() }, { merge: true });

    if (unlock) {
      await adminDb.collection("notifications").add({
        uid: user.uid,
        title: "Blood group unlocked",
        body: "Our team approved your request. Open your profile to pick the correct blood group.",
        tone: "success",
        read: false,
        createdAt: Date.now(),
        kind: "profile",
      });
    }
    return NextResponse.json({ ok: true, uid: user.uid, unlocked: unlock });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update the user." }, { status: 400 });
  }
}

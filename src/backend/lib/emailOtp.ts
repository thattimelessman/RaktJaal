import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/backend/lib/firebaseAdmin";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashOtp(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function createEmailOtp(uid: string, email: string, purpose: "registration" | "delete") {
  const ref = adminDb.collection("emailOtps").doc(`${purpose}_${uid}`);
  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data() || {};
    const lastSentAt = Number(data.lastSentAt || 0);
    if (Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
      throw new Error("Please wait a minute before requesting another OTP.");
    }
  }

  const code = generateOtp();
  await ref.set({
    uid,
    email: email.toLowerCase(),
    purpose,
    otpHash: hashOtp(code),
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Date.now() + OTP_TTL_MS,
    lastSentAt: Date.now(),
    attempts: 0,
  });
  return code;
}

export async function verifyEmailOtp(uid: string, email: string, purpose: "registration" | "delete", code: string) {
  const ref = adminDb.collection("emailOtps").doc(`${purpose}_${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("OTP not found. Please request a new OTP.");
  const data = snap.data() || {};
  if (data.email !== email.toLowerCase()) throw new Error("Email does not match this OTP.");
  if (Date.now() > Number(data.expiresAt || 0)) {
    await ref.delete();
    throw new Error("This OTP has expired. Please request a new one.");
  }
  const attempts = Number(data.attempts || 0);
  if (attempts >= MAX_ATTEMPTS) {
    await ref.delete();
    throw new Error("Too many incorrect attempts. Please request a new OTP.");
  }
  if (hashOtp(code) !== data.otpHash) {
    await ref.update({ attempts: attempts + 1 });
    throw new Error("Incorrect OTP. Please try again.");
  }
  await ref.delete();
}

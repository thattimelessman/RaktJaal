import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Was: `throw new Error(...)` at module load. That crashes EVERY route that
// imports this file (donation verification, account delete, OTP) the instant
// any one of these three env vars is missing — including in ways that look
// like an unrelated feature ("Confirm Donation") is broken, when the real
// cause is .env.local. We still refuse to run without real credentials, but
// each route now gets a clear, catchable error instead of a hard crash, and
// this message tells you exactly which of the three is missing.
let initError: string | null = null;
let realAuth: Auth | null = null;
let realDb: Firestore | null = null;

if (!projectId || !clientEmail || !privateKey) {
  const missing = [
    !projectId && "FIREBASE_ADMIN_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)",
    !clientEmail && "FIREBASE_ADMIN_CLIENT_EMAIL",
    !privateKey && "FIREBASE_ADMIN_PRIVATE_KEY",
  ].filter(Boolean);
  initError = `Missing Firebase Admin environment variable(s): ${missing.join(", ")}. Check .env.local.`;
} else {
  try {
    const adminApp = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    realAuth = getAuth(adminApp);
    realDb = getFirestore(adminApp);
  } catch (e) {
    initError = `Firebase Admin failed to initialize: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function requireAuth(): Auth {
  if (!realAuth) throw new Error(initError || "Firebase Admin is not initialized.");
  return realAuth;
}

function requireDb(): Firestore {
  if (!realDb) throw new Error(initError || "Firebase Admin is not initialized.");
  return realDb;
}

// Existing routes do `import { adminAuth, adminDb } from "@/backend/lib/firebaseAdmin"`
// and call e.g. adminAuth.verifyIdToken(...). Proxies here mean that keeps
// working unchanged, but the clear error above is thrown the moment a route
// actually USES adminAuth/adminDb, not merely for importing this file.
export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    return Reflect.get(requireAuth(), prop, receiver);
  },
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop, receiver) {
    return Reflect.get(requireDb(), prop, receiver);
  },
});
/* -----------------------------------------------------------------
   userProfile.ts — real Firestore replacement for the old
   localStorage "directory" in Authstore.js.

   Firestore collection: "users", doc id === Firebase Auth uid.
   This holds the account/profile fields the new AuthPage/ProfilePage
   designs collect (name, dob, email, address, bloodType, phone,
   secondary emails, etc). It is intentionally separate from the
   "donors" collection in src/lib/matching.ts: "donors" is the
   geohash-indexed collection used for nearby-donor search (it needs
   phone + lat/lng, captured today by /donor/signup), while "users"
   is just the account profile every signed-in person has.
-------------------------------------------------------------------- */

import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/backend/lib/firebase";

export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  dob?: string;
  bloodType?: string;
  address?: {
    pincode?: string;
    state?: string;
    city?: string;
    street?: string;
    country?: string;
  };
  phone?: string;
  secondaryEmails?: string[];
  profilePhoto?: string | null;
  createdAt?: number;
  [key: string]: unknown;
}

const usersCollection = "users";

/** Read a profile by uid. Returns null if the account has no profile doc yet. */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, usersCollection, uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}

/** Create (or overwrite) a profile — used right after sign-up. */
export async function createUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  await setDoc(doc(db, usersCollection, uid), {
    ...data,
    createdAt: Date.now(),
    updatedAt: serverTimestamp(),
  });
}

/** Partial update — used by ProfilePage's inline editors and Google sign-in backfill. */
export async function updateUserProfile(
  uid: string,
  patch: Partial<UserProfile>
): Promise<void> {
  await setDoc(
    doc(db, usersCollection, uid),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Ensures a profile doc exists (e.g. first-time Google sign-in) without clobbering existing data. */
export async function ensureUserProfile(
  uid: string,
  fallback: Partial<UserProfile>
): Promise<UserProfile> {
  const existing = await getUserProfile(uid);
  if (existing) return existing;
  await createUserProfile(uid, fallback);
  return { uid, ...fallback } as UserProfile;
}

/** Delete a profile doc — used by ProfilePage's "Delete account". */
export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, usersCollection, uid));
}

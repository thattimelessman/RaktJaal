import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type UserCredential,
} from "firebase/auth";
import { auth, googleProvider } from "@/backend/lib/firebase";

/** Friendly messages for the Firebase Auth error codes we actually expect to hit. */
function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists with this email. Try signing in instead.";
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was closed before finishing.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup. Please allow popups and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<UserCredential> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
    return cred;
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.emailVerified) {
      await sendEmailOtp("registration");
      await signOut(auth);
      throw new Error("Please verify your email with the OTP we sent before signing in.");
    }
    return cred;
  } catch (err) {
    if (err instanceof Error && !(err as { code?: string }).code) throw err;
    throw new Error(friendlyAuthError(err));
  }
}

export async function sendEmailOtp(purpose: "registration" | "delete"): Promise<void> {
  if (!auth.currentUser) throw new Error("No signed-in account found.");
  const token = await auth.currentUser.getIdToken(true);
  const response = await fetch("/api/email-otp/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ purpose }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not send the email OTP.");
}

export async function verifyEmailOtpCode(code: string, purpose: "registration" | "delete"): Promise<void> {
  if (!auth.currentUser) throw new Error("No signed-in account found.");
  const token = await auth.currentUser.getIdToken(true);
  const response = await fetch("/api/email-otp/verify", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ purpose, code }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not verify the email OTP.");
}

export async function deleteAccountWithEmailOtp(code: string): Promise<void> {
  if (!auth.currentUser) throw new Error("No signed-in account found.");
  const token = await auth.currentUser.getIdToken(true);
  const response = await fetch("/api/account/delete", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not delete the account.");
}

export async function signInWithGoogle(): Promise<UserCredential> {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}


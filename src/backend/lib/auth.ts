import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
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
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
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

/**
 * Deletes the currently signed-in Firebase Auth account.
 * Firebase requires a "recent" login for this; if the session is stale it
 * throws auth/requires-recent-login, which callers should surface as
 * "please sign in again, then retry deleting your account."
 */
export async function deleteCurrentUser(): Promise<void> {
  if (!auth.currentUser) throw new Error("No signed-in user to delete.");
  try {
    await deleteUser(auth.currentUser);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "auth/requires-recent-login") {
      throw new Error(
        "For your security, please sign out and sign back in, then try deleting your account again."
      );
    }
    throw new Error(friendlyAuthError(err));
  }
}

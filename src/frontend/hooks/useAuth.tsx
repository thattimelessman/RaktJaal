"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/backend/lib/firebase";
import { sendEmailOtp } from "@/backend/lib/auth";

interface AuthContextValue {
  /** Null while signed out, AND null while a 2FA-enabled account is
   *  mid-verification — the rest of the app (NavBar, protected pages)
   *  must not treat someone as signed in until their OTP is confirmed. */
  user: User | null;
  loading: boolean;
  /** Set only while a signed-in Firebase session belongs to an account
   *  with two-step verification on, and that step hasn't been completed
   *  yet this session. The login page reads this to show the OTP screen. */
  pendingTwoFactorUser: User | null;
  /** Called once the login page confirms the OTP — releases `user`. */
  completeTwoFactor: () => void;
  /** Re-reads auth.currentUser and pushes a fresh object into `user` state.
   *  Needed after linkWithCredential (e.g. setting a password): Firebase
   *  does NOT refire onAuthStateChanged for that, so without this, `user`
   *  keeps pointing at the pre-link snapshot and providerData looks stale
   *  everywhere (Security tab still saying "No password set"). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  pendingTwoFactorUser: null,
  completeTwoFactor: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pendingTwoFactorUser, setPendingTwoFactorUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracks uids that have already cleared 2FA this session, so re-running
  // the profile check on token refresh / other tabs doesn't re-prompt. A
  // ref (not state) so it doesn't need to be a listener dependency.
  const clearedUidsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      // Mark resolving true for the *whole* duration of this callback, not
      // just the very first one — a later re-fire (fresh sign-in, sign-out
      // then sign-in again) also has an async Firestore check in the
      // middle, and pages gate on `loading` to avoid rendering a
      // signed-out state while that's still in flight.
      setLoading(true);
      if (!u) {
        setUser(null);
        setPendingTwoFactorUser(null);
        setLoading(false);
        return;
      }
      if (clearedUidsRef.current.has(u.uid)) {
        setUser(u);
        setPendingTwoFactorUser(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const twoFactorEnabled = Boolean(snap.exists() && snap.data()?.twoFactorEnabled);
        if (twoFactorEnabled) {
          setUser(null);
          setPendingTwoFactorUser(u);
          // Fire the login OTP the moment we discover 2FA is required —
          // auth.currentUser is still this user, so the request is valid.
          sendEmailOtp("twofactor").catch(() => {
            /* the login page's own resend button surfaces failures */
          });
        } else {
          setUser(u);
          setPendingTwoFactorUser(null);
        }
      } catch {
        // Profile read failed — fail open rather than lock the person out.
        setUser(u);
        setPendingTwoFactorUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const completeTwoFactor = () => {
    if (!pendingTwoFactorUser) return;
    clearedUidsRef.current.add(pendingTwoFactorUser.uid);
    setUser(pendingTwoFactorUser);
    setPendingTwoFactorUser(null);
  };

  const refreshUser = async () => {
    const u = auth.currentUser;
    if (!u) return;
    await u.reload();
    // auth.currentUser is the SAME object reload() just mutated, so assign a
    // fresh reference or React won't see any change and skip the re-render.
    setUser(Object.assign(Object.create(Object.getPrototypeOf(u)), u));
  };

  return (
    <AuthContext.Provider value={{ user, loading, pendingTwoFactorUser, completeTwoFactor, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Access the current Firebase user anywhere in the client tree. */
export function useAuth() {
  return useContext(AuthContext);
}

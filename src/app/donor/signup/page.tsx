"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Superseded: signing in and completing a profile on /profile now publishes a
 * real donor card automatically (see syncDonorFromProfile), kept in sync with
 * the profile and refreshed on every change, rather than a one-time form here
 * that could drift out of date. Send people to the real Donate Blood flow.
 */
export default function LegacyDonorSignupRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/action?mode=donate");
  }, [router]);
  return <p className="text-center text-sm text-gray-500">Taking you to Donate Blood…</p>;
}

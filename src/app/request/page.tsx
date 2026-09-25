"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * This standalone form used to write anonymous requests/{autoId} docs with no
 * requesterUid/donorUid. That shape is now rejected outright by firestore.rules
 * (every request must be created by its own requester, as requests/{requester}_{donor}),
 * and the feature it powered — "ask for blood, see nearby donors" — is now the real,
 * signed-in Need Blood flow on /action, which also lets the donor approve/decline and
 * chat/call once approved. Redirect there instead of leaving a page that only errors.
 */
export default function LegacyRequestRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/action?mode=need");
  }, [router]);
  return <p className="text-center text-sm text-gray-500">Taking you to Need Blood…</p>;
}

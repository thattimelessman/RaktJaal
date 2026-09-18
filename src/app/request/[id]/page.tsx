"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/backend/lib/firebase";
import { matchDonors } from "@/backend/lib/matching";
import DonorCard from "@/frontend/components/DonorCard";
import type { BloodRequest, DonorMatch } from "@/backend/types";

export default function RequestMatchPage({
  params,
}: {
  params: { id: string };
}) {
  const [req, setReq] = useState<BloodRequest | null>(null);
  const [matches, setMatches] = useState<DonorMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const snap = await getDoc(doc(db, "requests", params.id));
        if (!snap.exists()) {
          if (!cancelled) setError("Request not found.");
          return;
        }
        const data = { id: snap.id, ...snap.data() } as BloodRequest;
        if (!cancelled) setReq(data);

        const donors = await matchDonors(data);
        if (!cancelled) setMatches(donors);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load matches.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return <p className="text-center text-sm text-gray-500">Finding donors nearby...</p>;
  }

  if (error) {
    return <p className="text-center text-sm text-blood-600">{error}</p>;
  }

  if (!req) return null;

  return (
    <div>
      <div className="card mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {req.bloodType} needed at {req.hospital}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {req.units} unit{req.units > 1 ? "s" : ""} · {req.urgency} urgency
        </p>
        {req.notes && <p className="mt-2 text-sm text-gray-500">{req.notes}</p>}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">
        {matches.length} donor{matches.length === 1 ? "" : "s"} found within 10km
      </h2>

      {matches.length === 0 ? (
        <p className="text-sm text-gray-500">
          No matching donors nearby yet. We&apos;ll keep this request open — share it
          to widen the search.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map((donor) => (
            <DonorCard key={donor.uid} donor={donor} />
          ))}
        </div>
      )}
    </div>
  );
}

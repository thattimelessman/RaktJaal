import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/backend/lib/firebase";
import { geohashSearchCells, haversineDistanceKm } from "@/backend/lib/geohash";
import type { BloodRequest, Donor, DonorMatch } from "@/backend/types";

const SEARCH_RADIUS_KM = 10;

/**
 * Phase 1 static match: query donors of the matching blood type inside the
 * geohash cell(s) around the request, then filter to a true radius with
 * haversine and sort nearest-first. One-shot (getDocs) — Phase 2 swaps this
 * for onSnapshot to go real-time.
 */
export async function matchDonors(req: BloodRequest): Promise<DonorMatch[]> {
  const cells = geohashSearchCells(req.lat, req.lng);
  const donorsRef = collection(db, "donors");

  const snapshots = await Promise.all(
    cells.map((cell) =>
      getDocs(
        query(
          donorsRef,
          where("bloodType", "==", req.bloodType),
          where("geohash", "==", cell)
        )
      )
    )
  );

  const seen = new Set<string>();
  const matches: DonorMatch[] = [];

  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);

      const donor = { uid: doc.id, ...doc.data() } as Donor;
      const distanceKm = haversineDistanceKm(req.lat, req.lng, donor.lat, donor.lng);

      if (distanceKm <= SEARCH_RADIUS_KM) {
        matches.push({ ...donor, distanceKm });
      }
    }
  }

  matches.sort((a, b) => a.distanceKm - b.distanceKm);
  return matches;
}

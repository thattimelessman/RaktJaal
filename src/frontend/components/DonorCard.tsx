import type { DonorMatch } from "@/backend/types";

export default function DonorCard({ donor }: { donor: DonorMatch }) {
  return (
    <div className="card flex items-center justify-between">
      <div>
        <p className="font-semibold text-gray-900">{donor.name}</p>
        <p className="text-sm text-gray-500">
          {donor.bloodType} · {donor.distanceKm.toFixed(1)} km away
        </p>
      </div>
      <span className="rounded-full bg-blood-50 px-3 py-1 text-sm font-medium text-blood-600">
        {donor.bloodType}
      </span>
    </div>
  );
}

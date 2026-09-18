"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/backend/lib/firebase";
import { useGeolocation } from "@/frontend/hooks/useGeolocation";
import { encodeGeohash } from "@/backend/lib/geohash";
import { BLOOD_TYPES, type BloodType, type Urgency } from "@/backend/types";

export default function RequestPage() {
  const router = useRouter();
  const { coords, loading: locLoading, error: locError, request } = useGeolocation();

  const [bloodType, setBloodType] = useState<BloodType>("O+");
  const [units, setUnits] = useState(1);
  const [hospital, setHospital] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [contactName, setContactName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const lat = coords?.lat ?? parseFloat(manualLat);
    const lng = coords?.lng ?? parseFloat(manualLng);

    if (!hospital.trim()) {
      setError("Enter the hospital or location name.");
      return;
    }
    if (!contactNumber.trim()) {
      setError("Enter a contact number for donors to reach.");
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Share the location or enter latitude/longitude manually.");
      return;
    }

    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "requests"), {
        bloodType,
        units,
        hospital: hospital.trim(),
        lat,
        lng,
        geohash: encodeGeohash(lat, lng),
        urgency,
        contactName: contactName.trim(),
        contactNumber: contactNumber.trim(),
        notes: notes.trim(),
        status: "open",
        createdAt: Date.now(),
      });
      router.push(`/request/${docRef.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't submit the request."
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
        Request blood
      </h1>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="bloodType">
              Blood type
            </label>
            <select
              id="bloodType"
              className="input"
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value as BloodType)}
            >
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="units">
              Units needed
            </label>
            <input
              id="units"
              type="number"
              min={1}
              className="input"
              value={units}
              onChange={(e) => setUnits(parseInt(e.target.value, 10) || 1)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="hospital">
            Hospital / location name
          </label>
          <input
            id="hospital"
            type="text"
            required
            className="input"
            value={hospital}
            onChange={(e) => setHospital(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="urgency">
            Urgency
          </label>
          <select
            id="urgency"
            className="input"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as Urgency)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="contactName">
            Your name (optional)
          </label>
          <input
            id="contactName"
            type="text"
            className="input"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="contactNumber">
            Contact number
          </label>
          <input
            id="contactNumber"
            type="tel"
            required
            placeholder="+91 98765 43210"
            className="input"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            rows={2}
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Location</label>
          {coords ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              Location captured ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={request}
                disabled={locLoading}
                className="rounded-lg border border-blood-600 px-3 py-2 text-sm font-medium text-blood-600 hover:bg-blood-50 disabled:opacity-60"
              >
                {locLoading ? "Getting location..." : "Use current location"}
              </button>
              {locError && <p className="text-xs text-blood-600">{locError}</p>}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  className="input"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  className="input"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-blood-600">{error}</p>}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Submitting..." : "Find donors"}
        </button>
      </form>
    </div>
  );
}

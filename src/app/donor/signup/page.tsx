"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/backend/lib/firebase";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useGeolocation } from "@/frontend/hooks/useGeolocation";
import { encodeGeohash } from "@/backend/lib/geohash";
import { BLOOD_TYPES, type BloodType } from "@/backend/types";

export default function DonorSignupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Not signed in: send to login, then bounce back here once authenticated.
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/donor/signup");
    }
  }, [loading, user, router]);

  const { coords, loading: locLoading, error: locError, request } = useGeolocation();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodType, setBloodType] = useState<BloodType>("O+");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user?.displayName) setName(user.displayName);
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user) return;

    const lat = coords?.lat ?? parseFloat(manualLat);
    const lng = coords?.lng ?? parseFloat(manualLng);

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!phone.trim()) {
      setError("Enter a phone number donors and requesters can be matched with.");
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Share your location or enter latitude/longitude manually.");
      return;
    }

    setSubmitting(true);
    try {
      await setDoc(doc(db, "donors", user.uid), {
        name: name.trim(),
        email: user.email ?? "",
        phone: phone.trim(),
        bloodType,
        lat,
        lng,
        geohash: encodeGeohash(lat, lng),
        authProvider: user.providerData[0]?.providerId ?? "password",
        createdAt: Date.now(),
      });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save your donor profile."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <p className="text-center text-sm text-gray-500">Loading...</p>;
  }

  if (success) {
    return (
      <div className="card mx-auto max-w-sm text-center">
        <h1 className="text-xl font-bold text-gray-900">You&apos;re registered!</h1>
        <p className="mt-2 text-sm text-gray-600">
          Thanks, {name}. We&apos;ll match you against nearby requests for{" "}
          {bloodType} blood. Your phone number is never shown publicly.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
        Become a donor
      </h1>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            type="text"
            required
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="phone">
            Phone number
          </label>
          <input
            id="phone"
            type="tel"
            required
            placeholder="+91 98765 43210"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            Kept private — never shown to requesters directly.
          </p>
        </div>

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
                {locLoading ? "Getting location..." : "Use my current location"}
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
          {submitting ? "Saving..." : "Register as a donor"}
        </button>
      </form>
    </div>
  );
}

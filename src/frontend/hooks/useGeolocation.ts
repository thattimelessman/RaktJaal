"use client";

import { useState } from "react";

interface Coords {
  lat: number;
  lng: number;
}

interface UseGeolocationResult {
  coords: Coords | null;
  loading: boolean;
  error: string | null;
  request: () => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function request() {
    if (!("geolocation" in navigator)) {
      setError("Geolocation isn't supported on this device. Enter your location manually.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enter your location manually."
            : "Couldn't get your location. Enter it manually."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return { coords, loading, error, request };
}

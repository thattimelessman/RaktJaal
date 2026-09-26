"use client";

import { useEffect, useRef, useState } from "react";

type Coordinates = { lat: number; lng: number };

type LocationMapProps = {
  value?: Coordinates | null;
  onChange?: (location: Coordinates, label?: string) => void;
  height?: number;
  className?: string;
  readOnly?: boolean;
};

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  remove: () => void;
  on: (event: string, handler: (event: { latlng: { lat: number; lng: number } }) => void) => void;
};

type Leaflet = {
  map: (el: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  marker: (coords: [number, number], options?: Record<string, unknown>) => { addTo: (map: LeafletMap) => LeafletMarker };
};

type LeafletMarker = {
  setLatLng: (coords: [number, number]) => LeafletMarker;
  bindPopup: (text: string) => LeafletMarker;
  openPopup: () => LeafletMarker;
  remove: () => void;
};

declare global {
  interface Window {
    L?: Leaflet;
  }
}

const DEFAULT_CENTER: Coordinates = { lat: 20.5937, lng: 78.9629 };

function loadLeaflet(): Promise<Leaflet> {
  if (typeof window === "undefined") return Promise.reject(new Error("Map is browser-only."));
  if (window.L) return Promise.resolve(window.L);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById("raktjaal-leaflet-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => window.L && resolve(window.L));
      existing.addEventListener("error", () => reject(new Error("Could not load the map library.")));
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.id = "raktjaal-leaflet-css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.id = "raktjaal-leaflet-script";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => {
      if (window.L) resolve(window.L);
      else reject(new Error("Map library loaded without Leaflet."));
    };
    script.onerror = () => reject(new Error("Could not load the map library."));
    document.body.appendChild(script);
  });
}

export default function LocationMap({ value, onChange, height = 320, className = "", readOnly = false }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapRef.current || mapInstance.current) return;
        const center = value || DEFAULT_CENTER;
        const map = L.map(mapRef.current, { zoomControl: true }).setView([center.lat, center.lng], value ? 15 : 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Display marker if we have coordinates (for readOnly mode or initial display)
        if (value && L) {
          if (markerRef.current) {
            markerRef.current.remove?.();
          }
          markerRef.current = L.marker([value.lat, value.lng], {
            title: readOnly ? "Request Location" : "Selected Location"
          }).addTo(map);
          
          if (readOnly) {
            markerRef.current.bindPopup(`Location: ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`);
            markerRef.current.openPopup();
          }
        }

        if (!readOnly && onChange) {
         map.on("click", (event) => {
         const coords = { lat: event.latlng.lat, lng: event.latlng.lng };
         onChange(coords);
        });
      }

        mapInstance.current = map;
      })
      .catch((error) => {
        if (!cancelled) setMapError(error instanceof Error ? error.message : "Could not load the map.");
      });

    return () => {
      cancelled = true;
      mapInstance.current?.remove();
      mapInstance.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    const L = window.L;
    if (!map || !L || !value) return;

    const coords: [number, number] = [value.lat, value.lng];
    map.setView(coords, 15);
    if (!markerRef.current) markerRef.current = L.marker(coords).addTo(map);
    else markerRef.current.setLatLng(coords);
    markerRef.current.bindPopup("Selected donation location").openPopup();
  }, [value]);

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setMapError("Your browser does not support location access.");
      return;
    }
    setLocating(true);
    setMapError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChange?.({ lat: position.coords.latitude, lng: position.coords.longitude }, "Current location");
      },
      () => {
        setLocating(false);
        setMapError("Location permission was denied or unavailable. You can choose a point on the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  async function searchLocation() {
    const query = search.trim();
    if (!query) return;
    setSearching(true);
    setMapError(null);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!response.ok) throw new Error("Location search failed.");
      const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (!results.length) {
        setMapError("Location not found. Try a nearby hospital, city, or address.");
        return;
      }
      const result = results[0];
      onChange?.({ lat: Number(result.lat), lng: Number(result.lon) }, result.display_name);
    } catch (error) {
      setMapError(error instanceof Error ? error.message : "Location search failed.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className={className}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchLocation();
            }
          }}
          placeholder="Search hospital, city or address"
          className="input flex-1"
          aria-label="Search location"
        />
        <button
          type="button"
          onClick={() => void searchLocation()}
          disabled={searching || !search.trim()}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100" style={{ height }}>
        <div ref={mapRef} className="h-full w-full" />
        {!mapError && (
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="absolute left-3 top-3 z-[500] rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-md hover:bg-gray-50 disabled:opacity-60"
          >
            {locating ? "Getting location..." : "📍 Use my current location"}
          </button>
        )}
        {mapError && (
          <div className="absolute inset-0 z-[600] flex items-center justify-center bg-white/90 p-5 text-center">
            <div>
              <p className="text-sm font-medium text-gray-700">{mapError}</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-3 text-xs font-semibold text-blood-600">
                Reload map
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-gray-500">
        {readOnly 
          ? `Request location: ${value?.lat.toFixed(5)}, ${value?.lng.toFixed(5)}`
          : `Click anywhere on the map to choose the donation/request location.${value ? ` Selected: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : ""}`
        }
      </p>
    </div>
  );
}

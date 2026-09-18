import ngeohash from "ngeohash";

/** Precision 6 ≈ up to ~1.2km x 0.6km cells — good balance for a 10km search radius. */
export const GEOHASH_PRECISION = 6;

export function encodeGeohash(lat: number, lng: number): string {
  return ngeohash.encode(lat, lng, GEOHASH_PRECISION);
}

/**
 * Returns the geohash cell plus its 8 neighbors, so a radius search near a
 * cell boundary doesn't miss donors who fall just outside the center cell.
 */
export function geohashSearchCells(lat: number, lng: number): string[] {
  const center = encodeGeohash(lat, lng);
  const neighbors = ngeohash.neighbors(center);
  return [center, ...neighbors];
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lng points, in kilometers. */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

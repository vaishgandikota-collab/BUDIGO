import { GeoCoordinate } from '../types';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates the great-circle distance between two points on Earth using Haversine formula.
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
  coord1: GeoCoordinate,
  coord2: GeoCoordinate
): number {
  const lat1Rad = (coord1.latitude * Math.PI) / 180;
  const lat2Rad = (coord2.latitude * Math.PI) / 180;
  const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates geographic centroid of multiple coordinates.
 */
export function calculateCentroid(coords: GeoCoordinate[]): GeoCoordinate {
  if (coords.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  let totalX = 0;
  let totalY = 0;
  let totalZ = 0;

  for (const coord of coords) {
    const latRad = (coord.latitude * Math.PI) / 180;
    const lonRad = (coord.longitude * Math.PI) / 180;

    totalX += Math.cos(latRad) * Math.cos(lonRad);
    totalY += Math.cos(latRad) * Math.sin(lonRad);
    totalZ += Math.sin(latRad);
  }

  const numPoints = coords.length;
  const avgX = totalX / numPoints;
  const avgY = totalY / numPoints;
  const avgZ = totalZ / numPoints;

  const centralLon = Math.atan2(avgY, avgX);
  const centralHyp = Math.sqrt(avgX * avgX + avgY * avgY);
  const centralLat = Math.atan2(avgZ, centralHyp);

  return {
    latitude: (centralLat * 180) / Math.PI,
    longitude: (centralLon * 180) / Math.PI,
  };
}

/**
 * Calculates the bounding box that encompasses all coordinates with an optional padding in meters.
 */
export function calculateBoundingBox(
  coords: GeoCoordinate[],
  paddingMeters = 1000
) {
  if (coords.length === 0) {
    return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
  }

  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLon = coords[0].longitude;
  let maxLon = coords[0].longitude;

  for (const c of coords) {
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLon) minLon = c.longitude;
    if (c.longitude > maxLon) maxLon = c.longitude;
  }

  const latDelta = (paddingMeters / 111320);
  const lonDelta =
    paddingMeters / (111320 * Math.cos((minLat * Math.PI) / 180));

  return {
    minLat: minLat - latDelta,
    maxLat: maxLat + latDelta,
    minLon: minLon - lonDelta,
    maxLon: maxLon + lonDelta,
  };
}

/**
 * Calculates initial bearing from coord1 to coord2 in degrees (0 - 360).
 */
export function calculateBearing(
  coord1: GeoCoordinate,
  coord2: GeoCoordinate
): number {
  const lat1 = (coord1.latitude * Math.PI) / 180;
  const lat2 = (coord2.latitude * Math.PI) / 180;
  const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}


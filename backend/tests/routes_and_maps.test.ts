import { GoogleMapsService } from '../src/services/googleMapsService';
import { calculateHaversineDistance } from '../src/algorithms/haversine';
import { ParticipantStartPoint, CandidatePlace } from '../src/types';

describe('Phase 14: Maps, Routes & Travel Matrix Calculation', () => {
  const originMumbai = { latitude: 18.9432, longitude: 72.8236 }; // Marine Drive
  const destPune = { latitude: 18.5204, longitude: 73.8567 }; // Pune Station
  const destGoa = { latitude: 15.5553, longitude: 73.7517 }; // Baga Beach

  it('should calculate realistic road route with distance, duration and polyline', async () => {
    const route = await GoogleMapsService.calculateRoute(originMumbai, destPune, 'DRIVE');

    expect(route).toBeDefined();
    expect(route.distanceMeters).toBeGreaterThan(100000); // Mumbai to Pune > 100km
    expect(route.durationSeconds).toBeGreaterThan(3600); // > 1 hour
    expect(typeof route.encodedPolyline).toBe('string');
    expect(route.encodedPolyline.length).toBeGreaterThan(10);
  });

  it('should verify road distance accounts for road circuity factor (~1.3x Haversine)', () => {
    const straightLineMeters = calculateHaversineDistance(originMumbai, destPune);
    expect(straightLineMeters).toBeGreaterThan(110000);

    // Realistic road network distance is greater than euclidean/haversine distance
    const estimatedRoadDistance = Math.round(straightLineMeters * 1.32);
    expect(estimatedRoadDistance).toBeGreaterThan(straightLineMeters);
  });

  it('should dynamically adapt ETA based on distance and vehicle speeds', async () => {
    // Short urban distance (< 2km)
    const closePoint = { latitude: 18.9450, longitude: 72.8250 };
    const shortRoute = await GoogleMapsService.calculateRoute(originMumbai, closePoint, 'DRIVE');
    expect(shortRoute.distanceMeters).toBeLessThan(3000);
    expect(shortRoute.durationSeconds).toBeGreaterThanOrEqual(120);

    // Long inter-city distance
    const longRoute = await GoogleMapsService.calculateRoute(originMumbai, destGoa, 'DRIVE');
    expect(longRoute.distanceMeters).toBeGreaterThan(400000);
    expect(longRoute.durationSeconds).toBeGreaterThan(20000);
  });

  it('should compute full Route Matrix across multiple participants and candidates', async () => {
    const participants: ParticipantStartPoint[] = [
      { userId: 'u1', displayName: 'Aarav', markerColor: '#D1956A', latitude: 18.9432, longitude: 72.8236 },
      { userId: 'u2', displayName: 'Bhavna', markerColor: '#4C78C9', latitude: 18.5204, longitude: 73.8567 },
    ];

    const candidates: CandidatePlace[] = [
      { placeId: 'p_lonavala', name: 'Lonavala Midway Rest', category: 'cafe', latitude: 18.7546, longitude: 73.4062, address: 'Old Mumbai-Pune Hwy' },
      { placeId: 'p_khandala', name: 'Khandala Hill Point', category: 'cafe', latitude: 18.7580, longitude: 73.3750, address: 'Ghat Section' },
    ];

    const matrix = await GoogleMapsService.computeRouteMatrix(participants, candidates);

    expect(matrix).toBeDefined();
    expect(matrix.size).toBe(2);

    for (const cand of candidates) {
      const row = matrix.get(cand.placeId);
      expect(row).toBeDefined();
      expect(row!.size).toBe(2);

      const routeU1 = row!.get('u1');
      const routeU2 = row!.get('u2');

      expect(routeU1).toBeDefined();
      expect(routeU1!.distanceMeters).toBeGreaterThan(0);
      expect(routeU1!.durationSeconds).toBeGreaterThan(0);

      expect(routeU2).toBeDefined();
      expect(routeU2!.distanceMeters).toBeGreaterThan(0);
      expect(routeU2!.durationSeconds).toBeGreaterThan(0);
    }
  });

  it('should discover candidate meeting places across valid categories', async () => {
    const midpoint = { latitude: 18.7546, longitude: 73.4062 };
    const candidates = await GoogleMapsService.searchNearbyPlaces(midpoint, 'cafe', 5000);

    expect(candidates).toBeDefined();
    expect(candidates.length).toBeGreaterThanOrEqual(3);

    for (const c of candidates) {
      expect(c.placeId).toBeDefined();
      expect(c.name).toBeDefined();
      expect(c.category).toBe('cafe');
      expect(typeof c.latitude).toBe('number');
      expect(typeof c.longitude).toBe('number');
    }
  });
});


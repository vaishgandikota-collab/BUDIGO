import { calculateHaversineDistance, calculateCentroid } from '../src/algorithms/haversine';
import { rankMeetingPointCandidates } from '../src/algorithms/minimaxOptimizer';
import { CandidatePlace, ParticipantStartPoint } from '../src/types';

describe('Geospatial & Minimax Optimizer Algorithms', () => {
  describe('Haversine Distance', () => {
    it('should accurately calculate distance between known points', () => {
      // Panaji (15.4989, 73.8278) to Baga Beach (15.5553, 73.7517)
      const panaji = { latitude: 15.4989, longitude: 73.8278 };
      const baga = { latitude: 15.5553, longitude: 73.7517 };

      const dist = calculateHaversineDistance(panaji, baga);
      // Expected straight line distance ~10.2 km (10200m +/- 500m)
      expect(dist).toBeGreaterThan(9500);
      expect(dist).toBeLessThan(11000);
    });

    it('should return 0 for identical points', () => {
      const point = { latitude: 15.5553, longitude: 73.7517 };
      const dist = calculateHaversineDistance(point, point);
      expect(dist).toBe(0);
    });
  });

  describe('Geographic Centroid', () => {
    it('should compute the correct centroid for multiple points', () => {
      const points = [
        { latitude: 10, longitude: 20 },
        { latitude: 20, longitude: 20 },
      ];
      const centroid = calculateCentroid(points);
      expect(centroid.latitude).toBeCloseTo(15, 0);
      expect(centroid.longitude).toBeCloseTo(20, 0);
    });
  });

  describe('Minimax Meeting Point Optimization', () => {
    it('should minimize the maximum individual travel time (minimax)', () => {
      const participants: ParticipantStartPoint[] = [
        { userId: 'u1', displayName: 'Aarav', markerColor: '#D1956A', latitude: 15.49, longitude: 73.82 },
        { userId: 'u2', displayName: 'Bhavna', markerColor: '#4C78C9', latitude: 15.51, longitude: 73.76 },
        { userId: 'u3', displayName: 'Chetan', markerColor: '#419A77', latitude: 15.54, longitude: 73.75 },
      ];

      const candidates: CandidatePlace[] = [
        {
          placeId: 'cand_fair_center',
          name: 'Fair Central Spot',
          category: 'cafe',
          latitude: 15.515,
          longitude: 73.775,
          address: 'Central Way',
          rating: 4.8,
        },
        {
          placeId: 'cand_unfair_far',
          name: 'Unfair Distant Spot',
          category: 'cafe',
          latitude: 15.65,
          longitude: 73.72,
          address: 'Far North',
          rating: 4.9,
        },
      ];

      // Route matrix mock
      const matrix = new Map<string, Map<string, { distanceMeters: number; durationSeconds: number }>>();

      // Candidate 1 (Central Spot): durations 600s, 700s, 800s -> max = 800s
      const c1Map = new Map();
      c1Map.set('u1', { distanceMeters: 4000, durationSeconds: 600 });
      c1Map.set('u2', { distanceMeters: 5000, durationSeconds: 700 });
      c1Map.set('u3', { distanceMeters: 6000, durationSeconds: 800 });
      matrix.set('cand_fair_center', c1Map);

      // Candidate 2 (Unfair Spot): durations 300s, 400s, 2400s (40 min) -> max = 2400s
      const c2Map = new Map();
      c2Map.set('u1', { distanceMeters: 2000, durationSeconds: 300 });
      c2Map.set('u2', { distanceMeters: 3000, durationSeconds: 400 });
      c2Map.set('u3', { distanceMeters: 20000, durationSeconds: 2400 });
      matrix.set('cand_unfair_far', c2Map);

      const ranked = rankMeetingPointCandidates(participants, candidates, matrix);

      expect(ranked.length).toBe(2);
      // The minimax algorithm MUST pick 'cand_fair_center' as #1 because its max ETA is 800s vs 2400s!
      expect(ranked[0].candidate.placeId).toBe('cand_fair_center');
      expect(ranked[0].maxTravelTimeSeconds).toBe(800);
      expect(ranked[1].candidate.placeId).toBe('cand_unfair_far');
      expect(ranked[1].maxTravelTimeSeconds).toBe(2400);
      expect(ranked[0].rankingScore).toBeGreaterThan(ranked[1].rankingScore);
    });

    it('should reject candidates with incomplete route matrix from optimal ranking', () => {
      const participants: ParticipantStartPoint[] = [
        { userId: 'u1', displayName: 'Aarav', markerColor: '#D1956A', latitude: 15.49, longitude: 73.82 },
        { userId: 'u2', displayName: 'Bhavna', markerColor: '#4C78C9', latitude: 15.51, longitude: 73.76 },
        { userId: 'u3', displayName: 'Chetan', markerColor: '#419A77', latitude: 15.54, longitude: 73.75 },
      ];

      const candidates: CandidatePlace[] = [
        {
          placeId: 'cand_incomplete',
          name: 'Unreachable Venue',
          category: 'cafe',
          latitude: 15.515,
          longitude: 73.775,
          address: 'Island Way',
          rating: 4.9,
        },
        {
          placeId: 'cand_complete',
          name: 'Accessible Central Cafe',
          category: 'cafe',
          latitude: 15.52,
          longitude: 73.78,
          address: 'Main Street',
          rating: 4.4,
        },
      ];

      const matrix = new Map<string, Map<string, { distanceMeters: number; durationSeconds: number }>>();

      // Candidate 1 (Incomplete): u3 route is missing / unreachable
      const c1Map = new Map();
      c1Map.set('u1', { distanceMeters: 3000, durationSeconds: 500 });
      c1Map.set('u2', { distanceMeters: 4000, durationSeconds: 600 });
      // u3 is omitted!
      matrix.set('cand_incomplete', c1Map);

      // Candidate 2 (Complete): all participants have routes
      const c2Map = new Map();
      c2Map.set('u1', { distanceMeters: 6000, durationSeconds: 900 });
      c2Map.set('u2', { distanceMeters: 7000, durationSeconds: 1000 });
      c2Map.set('u3', { distanceMeters: 6500, durationSeconds: 950 });
      matrix.set('cand_complete', c2Map);

      const ranked = rankMeetingPointCandidates(participants, candidates, matrix);

      // The complete candidate MUST be ranked #1
      expect(ranked[0].candidate.placeId).toBe('cand_complete');
      expect(ranked[0].rankingScore).toBeGreaterThan(0);
      expect(ranked[1].candidate.placeId).toBe('cand_incomplete');
    });

    it('should deduplicate candidates with identical placeId', () => {
      const participants: ParticipantStartPoint[] = [
        { userId: 'u1', displayName: 'Aarav', markerColor: '#D1956A', latitude: 15.49, longitude: 73.82 },
      ];

      const candidates: CandidatePlace[] = [
        { placeId: 'cand_dup', name: 'Duplicate 1', category: 'cafe', latitude: 15.5, longitude: 73.7, address: 'Road 1' },
        { placeId: 'cand_dup', name: 'Duplicate 2', category: 'cafe', latitude: 15.5, longitude: 73.7, address: 'Road 1' },
      ];

      const matrix = new Map<string, Map<string, { distanceMeters: number; durationSeconds: number }>>();
      const map = new Map();
      map.set('u1', { distanceMeters: 1000, durationSeconds: 300 });
      matrix.set('cand_dup', map);

      const ranked = rankMeetingPointCandidates(participants, candidates, matrix);
      expect(ranked.length).toBe(1);
    });

    it('should optimize across 4 participants spread across city quadrants', () => {
      // 4 buddies in North, South, East, West of city
      const participants: ParticipantStartPoint[] = [
        { userId: 'p_north', displayName: 'North Buddy', markerColor: '#D1956A', latitude: 15.60, longitude: 73.80 },
        { userId: 'p_south', displayName: 'South Buddy', markerColor: '#4C78C9', latitude: 15.40, longitude: 73.80 },
        { userId: 'p_east', displayName: 'East Buddy', markerColor: '#419A77', latitude: 15.50, longitude: 73.90 },
        { userId: 'p_west', displayName: 'West Buddy', markerColor: '#8B6BC1', latitude: 15.50, longitude: 73.70 },
      ];

      const candidates: CandidatePlace[] = [
        { placeId: 'spot_central', name: 'Central Interchange Cafe', category: 'cafe', latitude: 15.50, longitude: 73.80, address: 'City Center', rating: 4.7 },
        { placeId: 'spot_north_bias', name: 'North Suburb Diner', category: 'cafe', latitude: 15.58, longitude: 73.80, address: 'North Ring', rating: 4.8 },
      ];

      const matrix = new Map();
      // Spot central: approx 15 mins for all
      const mCentral = new Map();
      mCentral.set('p_north', { distanceMeters: 11000, durationSeconds: 900 });
      mCentral.set('p_south', { distanceMeters: 11000, durationSeconds: 900 });
      mCentral.set('p_east', { distanceMeters: 11000, durationSeconds: 900 });
      mCentral.set('p_west', { distanceMeters: 11000, durationSeconds: 900 });
      matrix.set('spot_central', mCentral);

      // Spot north: North buddy is 2 mins away, but South buddy takes 40 mins (2400s)!
      const mNorth = new Map();
      mNorth.set('p_north', { distanceMeters: 2000, durationSeconds: 150 });
      mNorth.set('p_south', { distanceMeters: 25000, durationSeconds: 2400 });
      mNorth.set('p_east', { distanceMeters: 16000, durationSeconds: 1500 });
      mNorth.set('p_west', { distanceMeters: 16000, durationSeconds: 1500 });
      matrix.set('spot_north_bias', mNorth);

      const ranked = rankMeetingPointCandidates(participants, candidates, matrix);

      // Even though north buddy is super close to spot_north, minimax chooses spot_central
      // because max(900, 900, 900, 900) = 900s << max(150, 2400, 1500, 1500) = 2400s!
      expect(ranked[0].candidate.placeId).toBe('spot_central');
      expect(ranked[0].maxTravelTimeSeconds).toBe(900);
    });
  });
});


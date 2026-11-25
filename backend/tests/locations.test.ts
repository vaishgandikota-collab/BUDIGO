import { GeofenceService } from '../src/services/geofenceService';

describe('Geofence & Arrival Detection System', () => {
  const roomId = 'test_room_101';
  const userId = 'user_traveler_1';
  const destination = { latitude: 15.5553, longitude: 73.7517 }; // Baga Beach

  beforeEach(() => {
    GeofenceService.clearUser(roomId, userId);
  });

  it('should mark status as On the Way when distant (> 500m)', () => {
    // Panaji (~10 km away)
    const distantLoc = { latitude: 15.4989, longitude: 73.8278, speed: 0.5, accuracy: 5 };
    const res = GeofenceService.evaluateArrival(roomId, userId, distantLoc, destination);

    expect(res.status).toBe('On the Way');
    expect(res.distanceMeters).toBeGreaterThan(9000);
    expect(res.triggerArrivalNotification).toBe(false);
  });

  it('should mark status as Moving when vehicle speed is active', () => {
    const movingLoc = { latitude: 15.52, longitude: 73.78, speed: 12.0, accuracy: 5 };
    const res = GeofenceService.evaluateArrival(roomId, userId, movingLoc, destination);

    expect(res.status).toBe('Moving');
    expect(res.triggerArrivalNotification).toBe(false);
  });

  it('should require consecutive close checks before triggering Arrival', () => {
    // Exact location within 50 meters
    const nearLoc = { latitude: 15.5552, longitude: 73.7516, speed: 0.1, accuracy: 4 };

    // Check 1: Near Destination (not yet verified arrival to prevent GPS jitter)
    const check1 = GeofenceService.evaluateArrival(roomId, userId, nearLoc, destination);
    expect(check1.status).toBe('Near Destination');
    expect(check1.triggerArrivalNotification).toBe(false);

    // Check 2: Second consecutive confirmed check -> Status 'Arrived' with notification!
    const check2 = GeofenceService.evaluateArrival(roomId, userId, nearLoc, destination);
    expect(check2.status).toBe('Arrived');
    expect(check2.triggerArrivalNotification).toBe(true);

    // Check 3: Subsequent check keeps 'Arrived' without firing duplicate notification
    const check3 = GeofenceService.evaluateArrival(roomId, userId, nearLoc, destination);
    expect(check3.status).toBe('Arrived');
    expect(check3.triggerArrivalNotification).toBe(false);
  });

  it('should reject inaccurate GPS readings (>30m accuracy) for arrival trigger', () => {
    // Within 20 meters but poor accuracy (accuracy = 80m)
    const inaccurateLoc = { latitude: 15.5553, longitude: 73.7517, accuracy: 80 };
    const res = GeofenceService.evaluateArrival(roomId, userId, inaccurateLoc, destination);

    // Should not trigger arrival
    expect(res.status).not.toBe('Arrived');
    expect(res.triggerArrivalNotification).toBe(false);
  });

  describe('Destination Navigation & Polyline Routing', () => {
    it('should calculate road distance and valid encoded polyline', async () => {
      const { GoogleMapsService } = await import('../src/services/googleMapsService');
      const origin = { latitude: 15.4989, longitude: 73.8278 };
      const dest = { latitude: 15.5553, longitude: 73.7517 };

      const route = await GoogleMapsService.calculateRoute(origin, dest, 'DRIVE');

      expect(route.distanceMeters).toBeGreaterThan(10000);
      expect(route.durationSeconds).toBeGreaterThan(300);
      expect(typeof route.encodedPolyline).toBe('string');
      expect(route.encodedPolyline.length).toBeGreaterThan(10);
    });
  });
});


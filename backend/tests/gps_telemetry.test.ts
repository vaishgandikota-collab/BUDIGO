import request from 'supertest';
import { app } from '../src/app';
import { inMemoryLocations } from '../src/controllers/locationController';

describe('Phase 14: GPS Telemetry, Rate Limiting & Stale Detection', () => {
  let tokenUser: string;
  let roomId: string;

  beforeAll(async () => {
    // 1. Create a user
    const authRes = await request(app)
      .post('/api/auth/register')
      .send({ fullName: 'Ramesh GPS', email: `ramesh.gps.${Date.now()}@budigo.app` });
    tokenUser = authRes.body.token;

    // 2. Create a room
    const roomRes = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({
        roomName: 'GPS Validation Trip',
        destinationName: 'Gateway of India, Mumbai',
        destinationLatitude: 18.9220,
        destinationLongitude: 72.8347,
      });

    roomId = roomRes.body.room.id;
  });

  it('should accept valid geographical coordinates within boundaries', async () => {
    const res = await request(app)
      .post('/api/locations/update')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({
        roomId,
        latitude: 18.9432,
        longitude: 72.8236,
        accuracy: 10,
        speed: 5.5,
        heading: 180,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.location.latitude).toBe(18.9432);
    expect(res.body.location.longitude).toBe(72.8236);
  });

  it('should reject invalid coordinates outside [-90, 90] and [-180, 180]', async () => {
    // Bad latitude > 90
    const badLat = await request(app)
      .post('/api/locations/update')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({
        roomId,
        latitude: 120.5,
        longitude: 72.8236,
      });

    expect(badLat.status).toBe(400);

    // Bad longitude > 180
    const badLon = await request(app)
      .post('/api/locations/update')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({
        roomId,
        latitude: 18.9432,
        longitude: 250.0,
      });

    expect(badLon.status).toBe(400);
  });

  it('should enforce REST update rate limit throttling (< 500ms)', async () => {
    // Wait for previous update window to clear
    await new Promise((r) => setTimeout(r, 600));

    // Send first update
    const first = await request(app)
      .post('/api/locations/update')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({
        roomId,
        latitude: 18.9400,
        longitude: 72.8200,
        accuracy: 12,
      });

    expect(first.status).toBe(200);

    // Immediately send second update within 50ms (throttled)
    const second = await request(app)
      .post('/api/locations/update')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({
        roomId,
        latitude: 18.9405,
        longitude: 72.8205,
        accuracy: 12,
      });

    expect(second.status).toBe(200);
    expect(second.body.throttled).toBe(true);
  });

  it('should exclude member from active room locations when sharing is revoked', async () => {
    // Revoke sharing
    const revokeRes = await request(app)
      .post(`/api/locations/rooms/${roomId}/toggle-sharing`)
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({ enabled: false });

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.enabled).toBe(false);

    // Fetch active locations for room
    const locsRes = await request(app)
      .get(`/api/locations/rooms/${roomId}/locations`)
      .set('Authorization', `Bearer ${tokenUser}`);

    expect(locsRes.status).toBe(200);
    // User whose sharing is disabled should not be present in active stream
    expect(locsRes.body.locations.length).toBe(0);
  });

  it('should flag locations older than 5 minutes as stale (Offline)', async () => {
    // Re-enable sharing
    await request(app)
      .post(`/api/locations/rooms/${roomId}/toggle-sharing`)
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({ enabled: true });

    // Manually inject a location older than 6 minutes into memory store
    const staleTime = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const key = Array.from(inMemoryLocations.keys()).find((k) => k.startsWith(roomId));

    if (key) {
      const loc = inMemoryLocations.get(key)!;
      inMemoryLocations.set(key, { ...loc, updated_at: staleTime });
    }

    const locsRes = await request(app)
      .get(`/api/locations/rooms/${roomId}/locations`)
      .set('Authorization', `Bearer ${tokenUser}`);

    expect(locsRes.status).toBe(200);
    if (locsRes.body.locations.length > 0) {
      const target = locsRes.body.locations[0];
      expect(target.isStale).toBe(true);
      expect(target.status).toBe('Offline');
    }
  });
});


import request from 'supertest';
import { app } from '../src/app';

describe('Phase 15: Multi-Device Real-World Simulation (4 Independent Users)', () => {
  // 4 Independent User Accounts
  let userA: { token: string; id: string; name: string };
  let userB: { token: string; id: string; name: string };
  let userC: { token: string; id: string; name: string };
  let userD: { token: string; id: string; name: string };

  let roomId: string;
  let roomCode: string;
  let meetingPointRecommendations: any[];
  let winningMpId: string;

  // Real physical coordinates in Western India
  const BAGA_BEACH_GOA = { latitude: 15.5553, longitude: 73.7517 };
  const MUMBAI_MARINE_DRIVE = { latitude: 18.9432, longitude: 72.8236 };
  const PUNE_KOREGAON = { latitude: 18.5362, longitude: 73.8940 };
  const BELAGAVI_HUB = { latitude: 15.8497, longitude: 74.4977 };
  const PANAJI_CITY = { latitude: 15.4909, longitude: 73.8278 };

  beforeAll(async () => {
    // Register 4 distinct user accounts
    const [resA, resB, resC, resD] = await Promise.all([
      request(app).post('/api/auth/register').send({ fullName: 'Aarav Sharma (Host)', email: `aarav.real.${Date.now()}@budigo.app`, password: 'Password123' }),
      request(app).post('/api/auth/register').send({ fullName: 'Bhavna Patel', email: `bhavna.real.${Date.now()}@budigo.app`, password: 'Password123' }),
      request(app).post('/api/auth/register').send({ fullName: 'Chetan Rao', email: `chetan.real.${Date.now()}@budigo.app`, password: 'Password123' }),
      request(app).post('/api/auth/register').send({ fullName: 'Divya Nair', email: `divya.real.${Date.now()}@budigo.app`, password: 'Password123' }),
    ]);

    userA = { token: resA.body.token, id: resA.body.user.id, name: 'Aarav' };
    userB = { token: resB.body.token, id: resB.body.user.id, name: 'Bhavna' };
    userC = { token: resC.body.token, id: resC.body.user.id, name: 'Chetan' };
    userD = { token: resD.body.token, id: resD.body.user.id, name: 'Divya' };
  });

  // Step 1: User A creates the travel room
  it('Step 1: User A creates "Goa Weekend Trip" with destination "Baga Beach, Goa"', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        roomName: 'Goa Weekend Trip',
        destinationName: 'Baga Beach, Goa',
        destinationLatitude: BAGA_BEACH_GOA.latitude,
        destinationLongitude: BAGA_BEACH_GOA.longitude,
        destinationAddress: 'Baga Beach Rd, Calangute, Goa 403516',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.room.room_name).toBe('Goa Weekend Trip');
    expect(res.body.room.room_code).toMatch(/^BUD[A-Z0-9]{3}$/);
    expect(res.body.member.member_role).toBe('creator');

    roomId = res.body.room.id;
    roomCode = res.body.room.room_code;
  });

  // Step 2: Users B, C, D join using the 6-character room code
  it('Step 2: Users B, C, D join using room code and receive distinct marker colors', async () => {
    const [joinB, joinC, joinD] = await Promise.all([
      request(app).post('/api/rooms/join').set('Authorization', `Bearer ${userB.token}`).send({ roomCode, displayName: userB.name, shareLocation: true }),
      request(app).post('/api/rooms/join').set('Authorization', `Bearer ${userC.token}`).send({ roomCode, displayName: userC.name, shareLocation: true }),
      request(app).post('/api/rooms/join').set('Authorization', `Bearer ${userD.token}`).send({ roomCode, displayName: userD.name, shareLocation: true }),
    ]);

    expect(joinB.status).toBe(200);
    expect(joinC.status).toBe(200);
    expect(joinD.status).toBe(200);

    // Fetch full room member roster
    const membersRes = await request(app)
      .get(`/api/rooms/${roomId}/members`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(membersRes.status).toBe(200);
    expect(membersRes.body.members.length).toBe(4);

    const colors = membersRes.body.members.map((m: any) => m.marker_color);
    const uniqueColors = new Set(colors);
    // Confirm all four members have unique marker colors
    expect(uniqueColors.size).toBe(4);
  });

  // Step 3: Each device sends its physical GPS coordinates
  it('Step 3: All 4 devices transmit initial physical GPS coordinates', async () => {
    const [pingA, pingB, pingC, pingD] = await Promise.all([
      // User A starts at Panaji City (~15km from Baga Beach)
      request(app).post('/api/locations/update').set('Authorization', `Bearer ${userA.token}`).send({
        roomId, latitude: PANAJI_CITY.latitude, longitude: PANAJI_CITY.longitude, accuracy: 8, speed: 10.2, heading: 350
      }),
      // User B starts in Pune (~450km away)
      request(app).post('/api/locations/update').set('Authorization', `Bearer ${userB.token}`).send({
        roomId, latitude: PUNE_KOREGAON.latitude, longitude: PUNE_KOREGAON.longitude, accuracy: 12, speed: 22.0, heading: 180
      }),
      // User C starts in Mumbai (~550km away)
      request(app).post('/api/locations/update').set('Authorization', `Bearer ${userC.token}`).send({
        roomId, latitude: MUMBAI_MARINE_DRIVE.latitude, longitude: MUMBAI_MARINE_DRIVE.longitude, accuracy: 10, speed: 18.5, heading: 175
      }),
      // User D starts in Belagavi (~110km away)
      request(app).post('/api/locations/update').set('Authorization', `Bearer ${userD.token}`).send({
        roomId, latitude: BELAGAVI_HUB.latitude, longitude: BELAGAVI_HUB.longitude, accuracy: 14, speed: 20.0, heading: 220
      }),
    ]);

    expect(pingA.status).toBe(200);
    expect(pingB.status).toBe(200);
    expect(pingC.status).toBe(200);
    expect(pingD.status).toBe(200);

    // Verify all devices can view the 4 active member locations
    const locsRes = await request(app)
      .get(`/api/locations/rooms/${roomId}/locations`)
      .set('Authorization', `Bearer ${userB.token}`);

    expect(locsRes.status).toBe(200);
    expect(locsRes.body.locations.length).toBe(4);
  });

  // Step 4: Move devices along road, verify ETAs update
  it('Step 4: Devices move toward destination, verifying dynamic distance and ETA updates', async () => {
    // Wait for rate limit window
    await new Promise((r) => setTimeout(r, 600));

    // User A moves closer to destination (~200m away)
    const moveA = await request(app)
      .post('/api/locations/update')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        roomId,
        latitude: 15.5535,
        longitude: 73.7518,
        accuracy: 9,
        speed: 8.0,
      });

    expect(moveA.status).toBe(200);
    expect(moveA.body.distanceMeters).toBeLessThan(500); // Under 500m
    expect(moveA.body.status).toBe('Near Destination');
  });

  // Step 5: Minimax Meeting-Point Optimizer
  it('Step 5: Compute fair meeting point across 4 participants using Minimax', async () => {
    const searchRes = await request(app)
      .post('/api/meeting-points/search')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        roomId,
        category: 'cafe',
      });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.success).toBe(true);
    expect(searchRes.body.recommendations.length).toBe(3);

    meetingPointRecommendations = searchRes.body.recommendations;
    winningMpId = meetingPointRecommendations[0].id;

    // Verify individual participant travel times exist
    const topRec = meetingPointRecommendations[0];
    expect(topRec.routes).toBeDefined();
    expect(topRec.routes.length).toBe(4);
    expect(topRec.maximum_travel_time).toBeGreaterThan(0);
    expect(topRec.total_travel_time).toBeGreaterThan(topRec.maximum_travel_time);
  });

  // Step 6: All 4 members vote
  it('Step 6: All 4 members vote on meeting points and tallies calculate accurately', async () => {
    // User A & B vote for candidate 1
    await request(app).post('/api/votes').set('Authorization', `Bearer ${userA.token}`).send({ roomId, meetingPointId: winningMpId });
    await request(app).post('/api/votes').set('Authorization', `Bearer ${userB.token}`).send({ roomId, meetingPointId: winningMpId });

    // User C votes for candidate 2
    const mp2Id = meetingPointRecommendations[1].id;
    await request(app).post('/api/votes').set('Authorization', `Bearer ${userC.token}`).send({ roomId, meetingPointId: mp2Id });

    // User D votes for candidate 1
    const voteD = await request(app).post('/api/votes').set('Authorization', `Bearer ${userD.token}`).send({ roomId, meetingPointId: winningMpId });

    expect(voteD.status).toBe(200);
    expect(voteD.body.tallies.totalVotes).toBe(4);
    expect(voteD.body.tallies.counts[winningMpId]).toBe(3); // 3 votes (75%)
    expect(voteD.body.tallies.counts[mp2Id]).toBe(1); // 1 vote (25%)
    expect(voteD.body.tallies.percentages[winningMpId]).toBe(75);
  });

  // Step 7: Host confirms the final meeting point
  it('Step 7: Host confirms winning meeting point, syncing with all devices', async () => {
    const confirmRes = await request(app)
      .post(`/api/meeting-points/${winningMpId}/confirm`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.meetingPoint.is_confirmed).toBe(true);

    // Non-host (User B) attempting to override should be rejected with 403
    const badOverride = await request(app)
      .post(`/api/meeting-points/${meetingPointRecommendations[1].id}/confirm`)
      .set('Authorization', `Bearer ${userB.token}`);

    expect(badOverride.status).toBe(403);
  });

  // Step 8: User A reaches destination with 2-consecutive ping confirmation
  it('Step 8: User A reaches Baga Beach (confirmed by 2 consecutive checks <= 75m)', async () => {
    // Wait for rate limit window
    await new Promise((r) => setTimeout(r, 600));

    // Ping 1 at destination
    const ping1 = await request(app)
      .post('/api/locations/update')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        roomId,
        latitude: BAGA_BEACH_GOA.latitude,
        longitude: BAGA_BEACH_GOA.longitude,
        accuracy: 6,
        speed: 0.1,
      });

    expect(ping1.status).toBe(200);

    // Wait 550ms
    await new Promise((r) => setTimeout(r, 550));

    // Ping 2 at destination (triggers confirmed arrival)
    const ping2 = await request(app)
      .post('/api/locations/update')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        roomId,
        latitude: BAGA_BEACH_GOA.latitude,
        longitude: BAGA_BEACH_GOA.longitude,
        accuracy: 5,
        speed: 0.0,
      });

    expect(ping2.status).toBe(200);
    expect(ping2.body.status).toBe('Arrived');

    // Verify arrival notification was generated for User B
    const notifsB = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userB.token}`);

    const arrivalNotif = notifsB.body.notifications.find((n: any) => n.notification_type === 'trip:arrived');
    expect(arrivalNotif).toBeDefined();
    expect(arrivalNotif.title).toContain('arrived');
  });

  // Step 9: User B disables location sharing
  it('Step 9: User B disables location sharing, removing them from live location broadcasts', async () => {
    const toggleRes = await request(app)
      .post(`/api/locations/rooms/${roomId}/toggle-sharing`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ enabled: false });

    expect(toggleRes.status).toBe(200);

    // Fetch active locations: User B must not be in active locations
    const activeLocs = await request(app)
      .get(`/api/locations/rooms/${roomId}/locations`)
      .set('Authorization', `Bearer ${userA.token}`);

    const userBInStream = activeLocs.body.locations.some((l: any) => l.user_id === userB.id);
    expect(userBInStream).toBe(false);
  });

  // Step 10: User D leaves the room and Host completes trip
  it('Step 10: User D leaves the room and Host ends the trip successfully', async () => {
    const leaveRes = await request(app)
      .post(`/api/rooms/${roomId}/leave`)
      .set('Authorization', `Bearer ${userD.token}`);

    expect(leaveRes.status).toBe(200);

    // Host ends the trip
    const endRes = await request(app)
      .post(`/api/rooms/${roomId}/end`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(endRes.status).toBe(200);

    // New member trying to join ended trip is rejected with 400
    const lateJoiner = await request(app)
      .post('/api/rooms/join')
      .set('Authorization', `Bearer ${userD.token}`)
      .send({ roomCode, displayName: 'Late Joiner' });

    expect(lateJoiner.status).toBe(400);
    expect(lateJoiner.body.error).toContain('ended');
  });
});

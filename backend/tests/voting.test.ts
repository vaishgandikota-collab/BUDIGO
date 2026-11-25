import request from 'supertest';
import { app } from '../src/app';

describe('Phase 8: Group Voting & Meeting Point Confirmation', () => {
  let tokenA: string; // Host
  let tokenB: string;
  let tokenC: string;
  let tokenD: string;
  let roomId: string;
  let roomCode: string;
  let mp1Id: string;
  let mp2Id: string;
  let mp3Id: string;

  beforeAll(async () => {
    // 1. Register 4 distinct user accounts
    const [resA, resB, resC, resD] = await Promise.all([
      request(app).post('/api/auth/register').send({ fullName: 'Aarav Host', email: 'aarav.vote@budigo.app' }),
      request(app).post('/api/auth/register').send({ fullName: 'Bhavna Buddy', email: 'bhavna.vote@budigo.app' }),
      request(app).post('/api/auth/register').send({ fullName: 'Chetan Buddy', email: 'chetan.vote@budigo.app' }),
      request(app).post('/api/auth/register').send({ fullName: 'Divya Buddy', email: 'divya.vote@budigo.app' }),
    ]);

    tokenA = resA.body.token;
    tokenB = resB.body.token;
    tokenC = resC.body.token;
    tokenD = resD.body.token;

    // 2. Host creates room
    const createRes = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        roomName: 'Mumbai Roadtrip',
        destinationName: 'Marine Drive, Mumbai',
        destinationLatitude: 18.9432,
        destinationLongitude: 72.8236,
      });

    roomId = createRes.body.room.id;
    roomCode = createRes.body.room.room_code;

    // 3. Buddies B, C, D join the room
    await Promise.all([
      request(app).post('/api/rooms/join').set('Authorization', `Bearer ${tokenB}`).send({ roomCode, displayName: 'Bhavna' }),
      request(app).post('/api/rooms/join').set('Authorization', `Bearer ${tokenC}`).send({ roomCode, displayName: 'Chetan' }),
      request(app).post('/api/rooms/join').set('Authorization', `Bearer ${tokenD}`).send({ roomCode, displayName: 'Divya' }),
    ]);
  });

  it('should discover top 3 meeting points for the room', async () => {
    const searchRes = await request(app)
      .post('/api/meeting-points/search')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        roomId,
        category: 'cafe',
      });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.success).toBe(true);
    expect(searchRes.body.recommendations.length).toBe(3);

    mp1Id = searchRes.body.recommendations[0].id;
    mp2Id = searchRes.body.recommendations[1].id;
    mp3Id = searchRes.body.recommendations[2].id;
  });

  it('should allow all 4 members to vote and calculate accurate percentage tallies', async () => {
    // User A and User B vote for mp1
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ roomId, meetingPointId: mp1Id });

    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ roomId, meetingPointId: mp1Id });

    // User C votes for mp2
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ roomId, meetingPointId: mp2Id });

    // User D votes for mp3
    const voteD = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${tokenD}`)
      .send({ roomId, meetingPointId: mp3Id });

    expect(voteD.status).toBe(200);
    expect(voteD.body.tallies.totalVotes).toBe(4);
    expect(voteD.body.tallies.counts[mp1Id]).toBe(2);
    expect(voteD.body.tallies.counts[mp2Id]).toBe(1);
    expect(voteD.body.tallies.counts[mp3Id]).toBe(1);

    // Percentages: 50%, 25%, 25%
    expect(voteD.body.tallies.percentages[mp1Id]).toBe(50);
    expect(voteD.body.tallies.percentages[mp2Id]).toBe(25);
    expect(voteD.body.tallies.percentages[mp3Id]).toBe(25);
  });

  it('should allow User D to change their vote without duplicating count', async () => {
    // User D switches vote from mp3 to mp1
    const switchRes = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${tokenD}`)
      .send({ roomId, meetingPointId: mp1Id });

    expect(switchRes.status).toBe(200);
    expect(switchRes.body.tallies.totalVotes).toBe(4); // Still exactly 4 votes total!
    expect(switchRes.body.tallies.counts[mp1Id]).toBe(3); // mp1 now has 3
    expect(switchRes.body.tallies.percentages[mp1Id]).toBe(75); // 75%
  });

  it('should prevent non-host from confirming final meeting point', async () => {
    const confirmRes = await request(app)
      .post(`/api/meeting-points/${mp1Id}/select`)
      .set('Authorization', `Bearer ${tokenB}`); // User B is member, not host

    expect(confirmRes.status).toBe(403);
    expect(confirmRes.body.success).toBe(false);
  });

  it('should allow host to confirm winning meeting point and lock selection', async () => {
    const confirmRes = await request(app)
      .post(`/api/meeting-points/${mp1Id}/select`)
      .set('Authorization', `Bearer ${tokenA}`); // User A is host

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.meetingPoint.is_confirmed).toBe(true);
  });
});


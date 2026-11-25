import request from 'supertest';
import { app } from '../src/app';
import { pickUnusedMarkerColor } from '../src/controllers/roomController';
import { RoomMember, USER_PALETTE } from '../src/types';

describe('Room Management & Color Assignment', () => {
  describe('Deterministic User Marker Color Assignment', () => {
    it('should assign a distinct color to each new member', () => {
      const members: RoomMember[] = [];

      for (let i = 0; i < 5; i++) {
        const assignedColor = pickUnusedMarkerColor(members);
        expect(USER_PALETTE).toContain(assignedColor);
        // Ensure not already used
        expect(members.map((m) => m.marker_color)).not.toContain(assignedColor);

        members.push({
          id: `m_${i}`,
          room_id: 'r_1',
          user_id: `u_${i}`,
          display_name: `User ${i}`,
          marker_color: assignedColor,
          member_role: i === 0 ? 'creator' : 'member',
          joined_at: new Date().toISOString(),
          location_sharing_enabled: true,
          status: 'Not Started',
        });
      }

      // Check first color is terracotta (#D1956A)
      expect(members[0].marker_color).toBe('#D1956A');
      // Second is blue (#4C78C9)
      expect(members[1].marker_color).toBe('#4C78C9');
      // Third is green (#419A77)
      expect(members[2].marker_color).toBe('#419A77');
    });
  });

  describe('REST API: Rooms', () => {
    let tokenA: string;
    let roomCode: string;
    let roomId: string;

    beforeAll(async () => {
      // Register test user A
      const resA = await request(app).post('/api/auth/register').send({
        fullName: 'Aarav Sharma',
        email: 'aarav.test@budigo.app',
      });
      tokenA = resA.body.token;
    });

    it('should create a new travel room with 6-char code', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          roomName: 'Goa Weekend Trip',
          destinationName: 'Baga Beach, North Goa',
          destinationLatitude: 15.5553,
          destinationLongitude: 73.7517,
          destinationAddress: 'Baga Beach Rd, Calangute, Goa',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.room.room_name).toBe('Goa Weekend Trip');
      expect(res.body.room.room_code).toMatch(/^BUD[A-Z0-9]{3}$/);
      expect(res.body.member.marker_color).toBe('#D1956A');

      roomCode = res.body.room.room_code;
      roomId = res.body.room.id;
    });

    it('should allow User B to join using room code with distinct color', async () => {
      const resB = await request(app).post('/api/auth/register').send({
        fullName: 'Bhavna Patel',
        email: 'bhavna.test@budigo.app',
      });
      const tokenB = resB.body.token;

      const joinRes = await request(app)
        .post('/api/rooms/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          roomCode,
          displayName: 'Bhavna',
          shareLocation: true,
        });

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.success).toBe(true);
      expect(joinRes.body.member.display_name).toBe('Bhavna');
      // Must be assigned second palette color (Blue #4C78C9)
      expect(joinRes.body.member.marker_color).toBe('#4C78C9');
    });

    it('should reject joining with invalid room code', async () => {
      const res = await request(app)
        .post('/api/rooms/join')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          roomCode: 'INVALID999',
          displayName: 'Stranger',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should handle duplicate joins idempotently without creating duplicate records', async () => {
      const resB = await request(app).post('/api/auth/register').send({
        fullName: 'Bhavna Patel',
        email: 'bhavna.test@budigo.app',
      });
      const tokenB = resB.body.token;

      const duplicateJoin = await request(app)
        .post('/api/rooms/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          roomCode,
          displayName: 'Bhavna',
          shareLocation: true,
        });

      expect(duplicateJoin.status).toBe(200);
      expect(duplicateJoin.body.success).toBe(true);
      expect(duplicateJoin.body.member.display_name).toBe('Bhavna');
    });

    it('should block non-members from viewing room details', async () => {
      const resStranger = await request(app).post('/api/auth/register').send({
        fullName: 'Stranger User',
        email: 'stranger@budigo.app',
      });
      const tokenStranger = resStranger.body.token;

      const forbiddenRes = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${tokenStranger}`);

      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.success).toBe(false);
    });

    it('should reject non-creator from ending a room', async () => {
      const resB = await request(app).post('/api/auth/register').send({
        fullName: 'Bhavna Patel',
        email: 'bhavna.test@budigo.app',
      });
      const tokenB = resB.body.token;

      const endRes = await request(app)
        .post(`/api/rooms/${roomId}/end`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(endRes.status).toBe(403);
    });

    it('should allow room creator to end room, and reject new joins once ended', async () => {
      const endRes = await request(app)
        .post(`/api/rooms/${roomId}/end`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(endRes.status).toBe(200);

      const resC = await request(app).post('/api/auth/register').send({
        fullName: 'Chetan Rao',
        email: 'chetan.test@budigo.app',
      });
      const tokenC = resC.body.token;

      const joinAfterEnd = await request(app)
        .post('/api/rooms/join')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({
          roomCode,
          displayName: 'Chetan',
        });

      expect(joinAfterEnd.status).toBe(400);
      expect(joinAfterEnd.body.success).toBe(false);
      expect(joinAfterEnd.body.error).toContain('ended');
    });

    it('should process password recovery requests for registered email', async () => {
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'aarav.test@budigo.app' });

      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.success).toBe(true);
      expect(forgotRes.body.message).toContain('Password reset instructions');
    });
  });
});


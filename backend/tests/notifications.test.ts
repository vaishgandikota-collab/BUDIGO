import request from 'supertest';
import { app } from '../src/app';
import { NotificationService } from '../src/services/notificationService';

describe('Phase 10: Smart Notifications & Lifecycle Alerts', () => {
  let tokenHost: string;
  let tokenBuddy: string;
  let roomId: string;
  let roomCode: string;
  let meetingPointId: string;

  beforeAll(async () => {
    // 1. Register Host and Buddy
    const [resHost, resBuddy] = await Promise.all([
      request(app).post('/api/auth/register').send({ fullName: 'Priya Host', email: 'priya.notif@budigo.app' }),
      request(app).post('/api/auth/register').send({ fullName: 'Rohan Buddy', email: 'rohan.notif@budigo.app' }),
    ]);

    tokenHost = resHost.body.token;
    tokenBuddy = resBuddy.body.token;

    // 2. Host creates travel room
    const createRes = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${tokenHost}`)
      .send({
        roomName: 'Goa Coastal Drive',
        destinationName: 'Baga Beach, Goa',
        destinationLatitude: 15.5553,
        destinationLongitude: 73.7517,
      });

    roomId = createRes.body.room.id;
    roomCode = createRes.body.room.room_code;
  });

  it('should register Expo Push Tokens safely', async () => {
    const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
    const res = await request(app)
      .post('/api/notifications/push-token')
      .set('Authorization', `Bearer ${tokenBuddy}`)
      .send({ token: validToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Invalid format should be rejected
    const badRes = await request(app)
      .post('/api/notifications/push-token')
      .set('Authorization', `Bearer ${tokenBuddy}`)
      .send({ token: 'invalid-non-expo-token' });

    expect(badRes.status).toBe(400);
  });

  it('should deliver notifications when member joins and updates unread counts', async () => {
    // Buddy joins room
    const joinRes = await request(app)
      .post('/api/rooms/join')
      .set('Authorization', `Bearer ${tokenBuddy}`)
      .send({ roomCode, displayName: 'Rohan' });

    expect(joinRes.status).toBe(200);

    // Host should have an unread notification about member joined
    const unreadRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenHost}`);

    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.unreadCount).toBeGreaterThanOrEqual(1);

    const listRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenHost}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.notifications.length).toBeGreaterThanOrEqual(1);
    const joinedNotif = listRes.body.notifications.find(
      (n: any) => n.notification_type === 'room:member-joined'
    );
    expect(joinedNotif).toBeDefined();
    expect(joinedNotif.title).toContain('New Traveler Joined');
  });

  it('should dispatch notification when destination is changed by host', async () => {
    const updateRes = await request(app)
      .patch(`/api/rooms/${roomId}/destination`)
      .set('Authorization', `Bearer ${tokenHost}`)
      .send({
        destinationName: 'Anjuna Beach, Goa',
        destinationLatitude: 15.5800,
        destinationLongitude: 73.7420,
      });

    expect(updateRes.status).toBe(200);

    // Buddy should receive destination changed alert
    const buddyNotifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenBuddy}`);

    const destNotif = buddyNotifs.body.notifications.find(
      (n: any) => n.notification_type === 'room:destination-changed'
    );
    expect(destNotif).toBeDefined();
    expect(destNotif.message).toContain('Anjuna Beach');
  });

  it('should dispatch notification when a member disables location sharing', async () => {
    const toggleRes = await request(app)
      .post(`/api/locations/rooms/${roomId}/toggle-sharing`)
      .set('Authorization', `Bearer ${tokenBuddy}`)
      .send({ enabled: false });

    expect(toggleRes.status).toBe(200);

    // Host should receive alert that location sharing was disabled
    const hostNotifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenHost}`);

    const sharingNotif = hostNotifs.body.notifications.find(
      (n: any) => n.notification_type === 'location:sharing-disabled'
    );
    expect(sharingNotif).toBeDefined();
  });

  it('should trigger arrival notification after 2 consecutive arrivals within 75m', async () => {
    // Re-enable location sharing
    await request(app)
      .post(`/api/locations/rooms/${roomId}/toggle-sharing`)
      .set('Authorization', `Bearer ${tokenBuddy}`)
      .send({ enabled: true });

    // Ping 1 at destination
    await request(app)
      .post('/api/locations/update')
      .set('Authorization', `Bearer ${tokenBuddy}`)
      .send({
        roomId,
        latitude: 15.5800,
        longitude: 73.7420,
        accuracy: 10,
        speed: 0.2,
      });

    // Wait 550ms to exceed REST rate limit throttle window
    await new Promise((r) => setTimeout(r, 550));

    // Ping 2 at destination (confirms arrival)
    const arriveRes = await request(app)
      .post('/api/locations/update')
      .set('Authorization', `Bearer ${tokenBuddy}`)
      .send({
        roomId,
        latitude: 15.5800,
        longitude: 73.7420,
        accuracy: 8,
        speed: 0.1,
      });

    expect(arriveRes.status).toBe(200);
    expect(arriveRes.body.status).toBe('Arrived');

    // Check notification in host's list
    const hostNotifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenHost}`);

    const arrivalNotif = hostNotifs.body.notifications.find(
      (n: any) => n.notification_type === 'trip:arrived'
    );
    expect(arrivalNotif).toBeDefined();
    expect(arrivalNotif.title).toContain('arrived');
  });

  it('should support mark as read and mark all as read', async () => {
    const hostNotifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenHost}`);

    const firstNotif = hostNotifs.body.notifications[0];
    expect(firstNotif).toBeDefined();

    // Mark single as read
    const readRes = await request(app)
      .patch(`/api/notifications/${firstNotif.id}/read`)
      .set('Authorization', `Bearer ${tokenHost}`);

    expect(readRes.status).toBe(200);

    // Mark all as read
    const markAllRes = await request(app)
      .post('/api/notifications/mark-all-read')
      .set('Authorization', `Bearer ${tokenHost}`);

    expect(markAllRes.status).toBe(200);

    // Unread count should now be 0
    const countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenHost}`);

    expect(countRes.body.unreadCount).toBe(0);
  });
});

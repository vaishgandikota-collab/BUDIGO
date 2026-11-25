import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { ENV } from '../src/config/env';

describe('Phase 14: Authentication, Session Recovery & Token Validation', () => {
  const testEmail = `auth.test.${Date.now()}@budigo.app`;
  const testPassword = 'StrongPassword123!';
  let authToken: string;
  let userId: string;

  it('should register a new user successfully and return JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Kabir Verma',
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.full_name).toBe('Kabir Verma');

    authToken = res.body.token;
    userId = res.body.user.id;
  });

  it('should reject registration when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'incomplete@budigo.app' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should authenticate user on login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
  });

  it('should reject login with missing email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should recover user profile with valid JWT session (/api/auth/me)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe(userId);
  });

  it('should reject session recovery with invalid or tampered token', async () => {
    const badToken = authToken + 'tampered';
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${badToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject session recovery when no Authorization header is present', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject expired tokens safely', async () => {
    // Generate an already-expired token
    const expiredToken = jwt.sign(
      { id: userId, email: testEmail, displayName: 'Kabir' },
      ENV.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('expired');
  });

  it('should process forgot-password requests gracefully', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testEmail });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Password reset');
  });

  it('should reject forgot-password with missing email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
  });
});

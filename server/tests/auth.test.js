import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';

const CSRF = { 'X-Fina-Client': 'web-app' };

describe('הרשמה והתחברות', () => {
  it('הרשמה מחזירה 201, עוגיות jwt+refresh, ותפקיד user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'בודק', email: 'reg1@test.com', password: 'Str0ngPass!' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toContain('jwt=');
    expect(cookies).toContain('refreshToken=');
  });

  it('אי אפשר להירשם כ-admin דרך ה-body (privilege escalation)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'תוקף', email: 'attacker@test.com', password: 'Str0ngPass!', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
  });

  it('התחברות עם סיסמה שגויה מחזירה 401', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'בודק', email: 'login1@test.com', password: 'Str0ngPass!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login1@test.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('refresh עם עוגייה תקפה מנפיק טוקנים חדשים', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ name: 'בודק', email: 'refresh1@test.com', password: 'Str0ngPass!' });

    const res = await agent.post('/api/auth/refresh');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'].join(';')).toContain('jwt=');
  });

  it('refresh בלי עוגייה מחזיר 401', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
  it('profile update requires auth and the client security header', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Old', email: 'profile@test.com', password: 'Str0ngPass!' });

    const blocked = await agent.put('/api/auth/profile').send({ name: 'New' });
    expect(blocked.status).toBe(403);

    const updated = await agent.put('/api/auth/profile').set(CSRF).send({ name: 'New Name' });
    expect(updated.status).toBe(200);
    expect(updated.body.user.name).toBe('New Name');
  });

  it('password change verifies the current password and accepts the new one', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Tester', email: 'password@test.com', password: 'Str0ngPass!' });

    const wrong = await agent.put('/api/auth/change-password').set(CSRF)
      .send({ currentPassword: 'wrong-password', newPassword: 'AnotherPass1!' });
    expect(wrong.status).toBe(401);

    const changed = await agent.put('/api/auth/change-password').set(CSRF)
      .send({ currentPassword: 'Str0ngPass!', newPassword: 'AnotherPass1!' });
    expect(changed.status).toBe(200);

    const login = await request(app).post('/api/auth/login')
      .send({ email: 'password@test.com', password: 'AnotherPass1!' });
    expect(login.status).toBe(200);
  });
});

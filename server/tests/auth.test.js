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
});

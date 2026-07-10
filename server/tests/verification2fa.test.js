import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../app.js';
import User from '../models/User.js';
import { issueEmailToken } from '../services/verificationService.js';

const CSRF = { 'X-Fina-Client': 'web-app' };

const registerAgent = async (email) => {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name: 'בודק', email, password: 'Str0ngPass!' });
  expect(res.status).toBe(201);
  return { agent, user: res.body.user };
};

describe('שלב 4 — אימות מייל', () => {
  it('הרשמה יוצרת משתמש לא-מאומת; טוקן תקין מסמן מאומת', async () => {
    const { user } = await registerAgent('verify1@test.com');
    expect(user.emailVerified).toBe(false);

    const doc = await User.findById(user._id);
    const { link } = await issueEmailToken(doc);
    const token = new URL(link).searchParams.get('token');

    const res = await request(app).post('/api/auth/verify-email').set(CSRF).send({ token });
    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).emailVerified).toBe(true);
  });

  it('טוקן שגוי מחזיר 400', async () => {
    const res = await request(app).post('/api/auth/verify-email').set(CSRF).send({ token: 'deadbeef' });
    expect(res.status).toBe(400);
  });

  it('resend-verification דורש התחברות', async () => {
    const res = await request(app).post('/api/auth/resend-verification').set(CSRF);
    expect(res.status).toBe(401);
  });
});

describe('שלב 4 — אימות דו-שלבי (2FA)', () => {
  it('setup → enable → login דו-שלבי → קבלת עוגיות', async () => {
    const { agent } = await registerAgent('tfa1@test.com');

    const setup = await agent.post('/api/auth/2fa/setup').set(CSRF);
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toBeTruthy();
    expect(setup.body.qr).toContain('data:image');

    const enable = await agent.post('/api/auth/2fa/enable').set(CSRF)
      .send({ code: authenticator.generate(setup.body.secret) });
    expect(enable.status).toBe(200);
    expect(Array.isArray(enable.body.recoveryCodes)).toBe(true);
    expect(enable.body.recoveryCodes.length).toBeGreaterThan(0);

    // Password login now stops at the second factor — no session cookies yet.
    const login = await request(app).post('/api/auth/login')
      .send({ email: 'tfa1@test.com', password: 'Str0ngPass!' });
    expect(login.status).toBe(200);
    expect(login.body.twoFactorRequired).toBe(true);
    expect(login.body.mfaToken).toBeTruthy();
    expect(login.headers['set-cookie']).toBeUndefined();

    const step2 = await request(app).post('/api/auth/2fa/login').set(CSRF)
      .send({ mfaToken: login.body.mfaToken, code: authenticator.generate(setup.body.secret) });
    expect(step2.status).toBe(200);
    expect(step2.headers['set-cookie'].join(';')).toContain('jwt=');
  });

  it('קוד שחזור מאפשר התחברות — ופעם אחת בלבד', async () => {
    const { agent } = await registerAgent('tfa2@test.com');
    const setup = await agent.post('/api/auth/2fa/setup').set(CSRF);
    const enable = await agent.post('/api/auth/2fa/enable').set(CSRF)
      .send({ code: authenticator.generate(setup.body.secret) });
    const recovery = enable.body.recoveryCodes[0];

    const login = await request(app).post('/api/auth/login').send({ email: 'tfa2@test.com', password: 'Str0ngPass!' });
    const step2 = await request(app).post('/api/auth/2fa/login').set(CSRF)
      .send({ mfaToken: login.body.mfaToken, code: recovery });
    expect(step2.status).toBe(200);

    const login2 = await request(app).post('/api/auth/login').send({ email: 'tfa2@test.com', password: 'Str0ngPass!' });
    const reuse = await request(app).post('/api/auth/2fa/login').set(CSRF)
      .send({ mfaToken: login2.body.mfaToken, code: recovery });
    expect(reuse.status).toBe(401);
  });

  it('disable מבטל את 2FA לאחר קוד תקין', async () => {
    const { agent } = await registerAgent('tfa3@test.com');
    const setup = await agent.post('/api/auth/2fa/setup').set(CSRF);
    await agent.post('/api/auth/2fa/enable').set(CSRF).send({ code: authenticator.generate(setup.body.secret) });

    const off = await agent.post('/api/auth/2fa/disable').set(CSRF).send({ code: authenticator.generate(setup.body.secret) });
    expect(off.status).toBe(200);

    // Login no longer requires a second factor.
    const login = await request(app).post('/api/auth/login').send({ email: 'tfa3@test.com', password: 'Str0ngPass!' });
    expect(login.body.twoFactorRequired).toBeUndefined();
    expect(login.headers['set-cookie'].join(';')).toContain('jwt=');
  });
});

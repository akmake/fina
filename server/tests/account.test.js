import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const CSRF = { 'X-Fina-Client': 'web-app' };

const registerAgent = async (email) => {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name: 'בודק', email, password: 'Str0ngPass!' });
  expect(res.status).toBe(201);
  return { agent, user: res.body.user };
};

describe('שלב 4 — ייצוא ומחיקת חשבון', () => {
  it('GET /api/account מחזיר פרופיל + מסלול', async () => {
    const { agent } = await registerAgent('acc1@test.com');
    const res = await agent.get('/api/account');
    expect(res.status).toBe(200);
    expect(res.body.account.email).toBe('acc1@test.com');
    expect(res.body.account.emailVerified).toBe(false);
    expect(res.body.plan.id).toBe('free');
  });

  it('ייצוא כולל את נתוני המשתמש', async () => {
    const { agent, user } = await registerAgent('acc2@test.com');
    await Transaction.create({ user: user._id, date: new Date(), description: 'בדיקה', amount: 50, type: 'הוצאה', category: 'כללי' });

    const res = await agent.get('/api/account/export');
    expect(res.status).toBe(200);
    expect(res.body.profile.email).toBe('acc2@test.com');
    expect(res.body.data.transactions.length).toBe(1);
  });

  it('מחיקה דורשת סיסמה נכונה ומנטרלת את החשבון', async () => {
    const { agent, user } = await registerAgent('acc3@test.com');

    const noPass = await agent.delete('/api/account').set(CSRF).send({});
    expect(noPass.status).toBe(401);

    const del = await agent.delete('/api/account').set(CSRF).send({ password: 'Str0ngPass!' });
    expect(del.status).toBe(200);

    const doc = await User.findById(user._id);
    expect(doc.deletedAt).toBeTruthy();
    expect(doc.email).not.toBe('acc3@test.com');
    expect(doc.passwordHash).toBeNull();

    // Old credentials no longer work.
    const login = await request(app).post('/api/auth/login').send({ email: 'acc3@test.com', password: 'Str0ngPass!' });
    expect(login.status).toBe(401);
  });

  it('onboarding מסמן onboardedAt', async () => {
    const { agent } = await registerAgent('acc4@test.com');
    const res = await agent.post('/api/account/onboarding').set(CSRF);
    expect(res.status).toBe(200);
    expect(res.body.onboardedAt).toBeTruthy();
  });
});

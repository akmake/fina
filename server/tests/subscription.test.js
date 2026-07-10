import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { isWithinLimit, hasFeature } from '../services/subscriptionService.js';

const CSRF = { 'X-Fina-Client': 'web-app' };

const registerAgent = async (email) => {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name: 'בודק', email, password: 'Str0ngPass!' });
  expect(res.status).toBe(201);
  return agent;
};

describe('שלב 4 — מנויים ותוכניות', () => {
  it('ברירת מחדל free; שדרוג לפרימיום (stub) עובד ונשמר', async () => {
    const agent = await registerAgent('sub1@test.com');

    const initial = await agent.get('/api/subscription');
    expect(initial.status).toBe(200);
    expect(initial.body.plan.id).toBe('free');

    const change = await agent.post('/api/subscription/change').set(CSRF).send({ plan: 'premium' });
    expect(change.status).toBe(200);
    expect(change.body.subscription.plan).toBe('premium');

    const after = await agent.get('/api/subscription');
    expect(after.body.plan.id).toBe('premium');
  });

  it('מסלול לא תקין נדחה עם 400', async () => {
    const agent = await registerAgent('sub2@test.com');
    const res = await agent.post('/api/subscription/change').set(CSRF).send({ plan: 'gold' });
    expect(res.status).toBe(400);
  });

  it('GET /api/subscription/plans מחזיר את הקטלוג', async () => {
    const agent = await registerAgent('sub3@test.com');
    const res = await agent.get('/api/subscription/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans.map((p) => p.id)).toEqual(expect.arrayContaining(['free', 'premium']));
  });

  it('לוגיקת מגבלות ופיצ׳רים (subscriptionService)', () => {
    expect(isWithinLimit('free', 'bankConnections', 1)).toBe(true);   // 1 < 2
    expect(isWithinLimit('free', 'bankConnections', 2)).toBe(false);  // reached cap
    expect(isWithinLimit('premium', 'bankConnections', 999)).toBe(true); // unlimited
    expect(hasFeature('premium', 'advancedReports')).toBe(true);
    expect(hasFeature('free', 'advancedReports')).toBe(false);
  });
});

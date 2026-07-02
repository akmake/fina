import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';

const CSRF = { 'X-Fina-Client': 'web-app' };

async function registerAgent(email) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: 'בודק', email, password: 'Str0ngPass!' });
  expect(res.status).toBe(201);
  return agent;
}

describe('בידוד נתונים בין משתמשים', () => {
  it('משתמש ב לא רואה עסקאות של משתמש א', async () => {
    const userA = await registerAgent('iso-a@test.com');
    const userB = await registerAgent('iso-b@test.com');

    const created = await userA
      .post('/api/transactions')
      .set(CSRF)
      .send({
        date: '2026-01-15',
        description: 'קניות סופר סודיות',
        amount: 250,
        type: 'הוצאה',
        category: 'מזון',
      });
    expect(created.status).toBe(201);

    const listA = await userA.get('/api/transactions');
    expect(listA.status).toBe(200);
    expect(listA.body.some((t) => t.description === 'קניות סופר סודיות')).toBe(true);

    const listB = await userB.get('/api/transactions');
    expect(listB.status).toBe(200);
    expect(listB.body.some((t) => t.description === 'קניות סופר סודיות')).toBe(false);
  });

  it('מחיקה רכה מסתירה עסקה מכל השאילתות', async () => {
    const agent = await registerAgent('iso-soft@test.com');

    const created = await agent
      .post('/api/transactions')
      .set(CSRF)
      .send({
        date: '2026-02-01',
        description: 'עסקה למחיקה',
        amount: 99,
        type: 'הוצאה',
      });
    expect(created.status).toBe(201);

    const del = await agent
      .delete(`/api/transactions/${created.body._id}`)
      .set(CSRF);
    expect(del.status).toBe(200);

    const list = await agent.get('/api/transactions');
    expect(list.body.some((t) => t._id === created.body._id)).toBe(false);
  });
});

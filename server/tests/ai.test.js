import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { registerApproved } from './helpers.js';
import { persistTransactions } from '../services/transactionPersistence.js';
import { israelMonthStart, israelMonthKey } from '../utils/israelTime.js';

const CSRF = { 'X-Fina-Client': 'web-app' };

const userWithKey = async (email) => {
  const agent = request.agent(app);
  const login = await registerApproved(agent, { email });
  const created = await agent.post('/api/ai-keys').set(CSRF).send({ name: 'Claude' });
  expect(created.status).toBe(201);
  expect(created.body.token).toMatch(/^fk_/);
  return { agent, user: login.body.user, token: created.body.token, keyId: created.body.key._id };
};

const ai = (path, token) => request(app).get(`/api/ai${path}`).set('Authorization', `Bearer ${token}`);

const tx = (date, amount, description, type = 'הוצאה', category = 'מסעדות') =>
  ({ date, amount, description, type, category, account: 'checking' });

describe('MCP — API קריאה בלבד עם מפתח AI', () => {
  it('סיכום חודש, חיפוש וחלוקת הוצאות מחזירים את הנתונים של המשתמש', async () => {
    const { user, token } = await userWithKey('ai1@test.com');
    const inMonth = new Date(israelMonthStart(new Date()).getTime() + 2 * 24 * 60 * 60 * 1000);
    await persistTransactions({ userId: user._id, transactions: [
      tx(inMonth, 120, 'פיצה (סניף מרכז)'),
      tx(inMonth, 80, 'קפה', 'הוצאה', 'קפה'),
      tx(inMonth, 10000, 'משכורת', 'הכנסה', 'משכורת'),
    ] });

    const month = israelMonthKey(new Date()).slice(0, 7);
    const ov = await ai(`/overview?month=${month}`, token);
    expect(ov.status).toBe(200);
    expect(ov.body).toMatchObject({ month, income: 10000, expense: 200, net: 9800, transactionCount: 3 });
    expect(ov.body.topCategories[0]).toEqual({ category: 'מסעדות', total: 120 });

    // Literal search — "(" must not break the query (AUDIT P2-7 class of bug)
    const search = await ai(`/transactions?q=${encodeURIComponent('(סניף')}&type=expense`, token);
    expect(search.status).toBe(200);
    expect(search.body.total).toBe(1);
    expect(search.body.transactions[0]).toMatchObject({ description: 'פיצה (סניף מרכז)', amount: 120, type: 'expense' });

    const sp = await ai('/spending?groupBy=category', token);
    expect(sp.status).toBe(200);
    expect(sp.body.total).toBe(200);
    expect(sp.body.groups.map((g) => g.category)).toEqual(['מסעדות', 'קפה']);

    expect((await ai('/spending?groupBy=nope', token)).status).toBe(400);
    expect((await ai('/overview?month=2026-13', token)).status).toBe(400);
  });

  it('המפתח לקריאה בלבד, מבודד בין משתמשים, ומבוטל מיד', async () => {
    const a = await userWithKey('ai-a@test.com');
    const b = await userWithKey('ai-b@test.com');
    await persistTransactions({ userId: a.user._id, transactions: [tx(new Date(), 999, 'סוד של א')] });

    const bSearch = await ai('/transactions?q=סוד', b.token);
    expect(bSearch.body.total).toBe(0);

    const write = await request(app).post('/api/ai/transactions').set(CSRF).set('Authorization', `Bearer ${a.token}`).send({});
    expect(write.status).toBe(405);

    // A session cookie alone is not an AI key, and neither is a phone token.
    expect((await a.agent.get('/api/ai/overview')).status).toBe(401);
    const phone = await a.agent.post('/api/devices').set(CSRF).send({});
    expect((await ai('/overview', phone.body.token)).status).toBe(401);
    // ...and the AI key is not a session anywhere else.
    expect((await request(app).get('/api/transactions').set('Authorization', `Bearer ${a.token}`)).status).toBe(401);

    const keys = await a.agent.get('/api/ai-keys');
    expect(keys.body).toHaveLength(1);
    expect(keys.body[0].tokenHash).toBeUndefined();
    await a.agent.delete(`/api/ai-keys/${a.keyId}`).set(CSRF);
    expect((await ai('/overview', a.token)).status).toBe(401);
  });

  it('חיבורים והתראות זמינים לעוזר', async () => {
    const { agent, token } = await userWithKey('ai2@test.com');
    await agent.post('/api/connections').set(CSRF).send({ company: 'leumi', username: 'u', password: 'p', syncHour: 8 });
    const conns = await ai('/connections', token);
    expect(conns.status).toBe(200);
    expect(conns.body[0]).toMatchObject({ provider: 'leumi', dailySyncHourIsrael: 8, waitingForSmsCode: false });
    expect(JSON.stringify(conns.body)).not.toMatch(/credentials|password/);
    expect((await ai('/alerts', token)).status).toBe(200);
  });
});

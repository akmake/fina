import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { registerApproved } from './helpers.js';
import { persistTransactions } from '../services/transactionPersistence.js';
import Budget from '../models/Budget.js';
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

  it('שינוי שמות וקטגוריות — רק עם מפתח שקיבל הרשאה, ונלמד לייבוא הבא', async () => {
    const agent = request.agent(app);
    const { body: { user } } = await registerApproved(agent, { email: 'ai-cat@test.com' });
    const readOnly = (await agent.post('/api/ai-keys').set(CSRF).send({ name: 'קריאה' })).body.token;
    const writer = (await agent.post('/api/ai-keys').set(CSRF).send({ name: 'כותב', allowCategorize: true })).body;
    expect(writer.key.scopes).toEqual(['categorize']);
    const post = (path, token, body) => request(app).post(`/api/ai/categorize/${path}`).set(CSRF).set('Authorization', `Bearer ${token}`).send(body);

    const raw = 'PAYPAL *NETFLIX.COM 4029357733';
    const row = (date) => ({ date, amount: 54.9, description: raw, rawDescription: raw, type: 'הוצאה', category: 'כללי', account: 'checking' });
    await persistTransactions({ userId: user._id, transactions: [row(new Date('2026-09-05')), row(new Date('2026-10-05'))] });

    // A read-only key can't write.
    expect((await post('merchant-name', readOnly, { currentName: raw, newName: 'נטפליקס' })).status).toBe(405);

    const dry = await post('merchant-name', writer.token, { currentName: raw, newName: 'נטפליקס', dryRun: true });
    expect(dry.body).toMatchObject({ dryRun: true, wouldUpdate: 2 });
    expect((await ai(`/transactions?q=${encodeURIComponent('נטפליקס')}`, writer.token)).body.total).toBe(0);

    const renamed = await post('merchant-name', writer.token, { currentName: raw, newName: 'נטפליקס' });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ updated: 2, rulesLearned: 1 });

    // Category that doesn't exist → clear 404 unless explicitly created.
    expect((await post('merchant-category', writer.token, { merchant: 'נטפליקס', category: 'מנויים' })).status).toBe(404);
    const cat = await post('merchant-category', writer.token, { merchant: 'נטפליקס', category: 'מנויים', createIfMissing: true });
    expect(cat.body).toMatchObject({ updated: 2, categoryCreated: true });

    // Learned: next month's import of the same raw bank text arrives renamed + categorized.
    await persistTransactions({ userId: user._id, transactions: [row(new Date('2026-11-05'))] });
    const after = await ai(`/transactions?q=${encodeURIComponent('נטפליקס')}`, writer.token);
    expect(after.body.total).toBe(3);
    expect(after.body.transactions.every((t) => t.category === 'מנויים')).toBe(true);

    // One-off fix of a single transaction by id.
    const one = await post('transaction-category', writer.token, { transactionId: after.body.transactions[0].id, category: 'פנאי', createIfMissing: true });
    expect(one.body).toMatchObject({ previousCategory: 'מנויים', category: 'פנאי' });

    // Rename a category everywhere it is referenced (incl. the budget).
    await Budget.create({ user: user._id, month: 11, year: 2026, totalLimit: 100, items: [{ category: 'מנויים', limit: 100 }] });
    const rc = await post('rename-category', writer.token, { currentName: 'מנויים', newName: 'מנויים דיגיטליים' });
    expect(rc.body).toMatchObject({ transactionsUpdated: 2, budgetsUpdated: 1 });
    expect((await Budget.findOne({ user: user._id })).items[0].category).toBe('מנויים דיגיטליים');
    expect((await post('rename-category', writer.token, { currentName: 'מנויים דיגיטליים', newName: 'פנאי' })).status).toBe(409);

    const cats = await ai('/categories', writer.token);
    expect(cats.body.map((c) => c.name)).toEqual(expect.arrayContaining(['מנויים דיגיטליים', 'פנאי']));
  });

  it('MCP מרוחק (ChatGPT): מפתח בכתובת → אתחול, רשימת כלים, קריאה; בלי מפתח תקין → 401', async () => {
    const { token } = await userWithKey('ai-mcp@test.com');
    const rpc = (body, key = token) => request(app).post(`/api/mcp/${key}`)
      .set('Accept', 'application/json, text/event-stream').send({ jsonrpc: '2.0', id: 1, ...body });

    const init = await rpc({ method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
    expect(init.status).toBe(200);
    expect(init.body.result.serverInfo.name).toBe('fina');

    const list = await rpc({ method: 'tools/list', params: {} });
    expect(list.body.result.tools.map((t) => t.name)).toEqual(expect.arrayContaining(['get_month_overview', 'rename_merchant']));

    const call = await rpc({ method: 'tools/call', params: { name: 'get_month_overview', arguments: {} } });
    expect(JSON.parse(call.body.result.content[0].text)).toHaveProperty('income');

    // A read-only key can't rename (tool error, not a crash).
    const denied = await rpc({ method: 'tools/call', params: { name: 'rename_merchant', arguments: { currentName: 'a', newName: 'b' } } });
    expect(denied.body.result.isError).toBe(true);

    expect((await rpc({ method: 'tools/list', params: {} }, 'fk_wrong')).status).toBe(401);
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

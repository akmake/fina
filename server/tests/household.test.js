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

async function invite(ownerAgent, email, role) {
  const res = await ownerAgent.post('/api/household/invite').set(CSRF).send({ email, role });
  expect(res.status).toBe(201);
  return res.body.invite.token;
}

describe('משק בית (Household) — שלב 1', () => {
  it('כל משתמש חדש מקבל משק בית אישי כ-owner', async () => {
    const agent = await registerAgent('hh-solo@test.com');
    const res = await agent.get('/api/household');
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    const me = res.body.members.find((m) => m.user?.email === 'hh-solo@test.com');
    expect(me?.role).toBe('owner');
  });

  it('חברים באותו משק בית רואים את אותם נתונים', async () => {
    const owner = await registerAgent('hh-owner@test.com');
    const partner = await registerAgent('hh-partner@test.com');

    const tx = await owner.post('/api/transactions').set(CSRF).send({
      date: '2026-03-01',
      description: 'עסקת משק בית משותפת',
      amount: 100,
      type: 'הוצאה',
      category: 'כללי',
    });
    expect(tx.status).toBe(201);

    const token = await invite(owner, 'hh-partner@test.com', 'partner');
    const acc = await partner.post('/api/household/accept').set(CSRF).send({ token });
    expect(acc.status).toBe(200);

    const list = await partner.get('/api/transactions');
    expect(list.status).toBe(200);
    expect(list.body.some((t) => t.description === 'עסקת משק בית משותפת')).toBe(true);
  });

  it('צופה (viewer) יכול לקרוא אך לא לכתוב', async () => {
    const owner = await registerAgent('hh-owner2@test.com');
    const viewer = await registerAgent('hh-viewer@test.com');

    const token = await invite(owner, 'hh-viewer@test.com', 'viewer');
    await viewer.post('/api/household/accept').set(CSRF).send({ token });

    const read = await viewer.get('/api/transactions');
    expect(read.status).toBe(200);

    const write = await viewer.post('/api/transactions').set(CSRF).send({
      date: '2026-03-02',
      description: 'ניסיון כתיבה של צופה',
      amount: 50,
      type: 'הוצאה',
    });
    expect(write.status).toBe(403);
  });

  it('רק בעל בית יכול להזמין', async () => {
    const owner = await registerAgent('hh-owner3@test.com');
    const partner = await registerAgent('hh-partner3@test.com');

    const token = await invite(owner, 'hh-partner3@test.com', 'partner');
    await partner.post('/api/household/accept').set(CSRF).send({ token });

    const partnerInvite = await partner
      .post('/api/household/invite')
      .set(CSRF)
      .send({ email: 'stranger@test.com', role: 'viewer' });
    expect(partnerInvite.status).toBe(403);
  });

  it('טוקן הזמנה שגוי מוחזר 404', async () => {
    const user = await registerAgent('hh-badtoken@test.com');
    const res = await user.post('/api/household/accept').set(CSRF).send({ token: 'not-a-real-token' });
    expect(res.status).toBe(404);
  });
});

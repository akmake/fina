import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import Alert from '../models/Alert.js';
import { registerApproved } from './helpers.js';

const CSRF = { 'X-Fina-Client': 'web-app' };
const PASS = 'Str0ngPass!';

const makeAdmin = async (email) => {
  const agent = request.agent(app);
  await registerApproved(agent, { email });
  await User.updateOne({ email }, { $set: { role: 'admin' } });
  // role lives in the access token → log in again to get an admin token
  await agent.post('/api/auth/login').send({ email, password: PASS });
  return agent;
};

describe('הרשמה והתחברות', () => {
  it('הרשמה היא בקשת גישה: 202, ממתין, בלי עוגיות סשן', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'בודק', email: 'reg1@test.com', password: PASS });

    expect(res.status).toBe(202);
    expect(res.body.pendingApproval).toBe(true);
    expect((res.headers['set-cookie'] || []).join(';')).not.toContain('jwt=');
    expect((await User.findOne({ email: 'reg1@test.com' })).approvalStatus).toBe('pending');
  });

  it('אי אפשר להירשם כ-admin דרך ה-body (privilege escalation)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'תוקף', email: 'attacker@test.com', password: PASS, role: 'admin' });

    expect(res.status).toBe(202);
    expect((await User.findOne({ email: 'attacker@test.com' })).role).toBe('user');
  });

  it('סיסמה קצרה מ-8 תווים נדחית', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'בודק', email: 'short@test.com', password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('התחברות עם סיסמה שגויה מחזירה 401', async () => {
    await registerApproved(request.agent(app), { email: 'login1@test.com' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login1@test.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('refresh עם עוגייה תקפה מנפיק טוקנים חדשים', async () => {
    const agent = request.agent(app);
    await registerApproved(agent, { email: 'refresh1@test.com' });

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
    await registerApproved(agent, { name: 'Old', email: 'profile@test.com' });

    const blocked = await agent.put('/api/auth/profile').send({ name: 'New' });
    expect(blocked.status).toBe(403);

    const updated = await agent.put('/api/auth/profile').set(CSRF).send({ name: 'New Name' });
    expect(updated.status).toBe(200);
    expect(updated.body.user.name).toBe('New Name');
  });

  it('password change verifies the current password and accepts the new one', async () => {
    const agent = request.agent(app);
    await registerApproved(agent, { name: 'Tester', email: 'password@test.com' });

    const wrong = await agent.put('/api/auth/change-password').set(CSRF)
      .send({ currentPassword: 'wrong-password', newPassword: 'AnotherPass1!' });
    expect(wrong.status).toBe(401);

    const changed = await agent.put('/api/auth/change-password').set(CSRF)
      .send({ currentPassword: PASS, newPassword: 'AnotherPass1!' });
    expect(changed.status).toBe(200);

    const login = await request(app).post('/api/auth/login')
      .send({ email: 'password@test.com', password: 'AnotherPass1!' });
    expect(login.status).toBe(200);
  });

  it('logout-all ends every session, including one on another device', async () => {
    const phone = request.agent(app);
    await registerApproved(phone, { name: 'Tester', email: 'logoutall@test.com' });
    const laptop = request.agent(app);
    await laptop.post('/api/auth/login').send({ email: 'logoutall@test.com', password: PASS });

    expect((await request(app).post('/api/auth/logout-all').set(CSRF)).status).toBe(401);
    expect((await phone.post('/api/auth/logout-all').set(CSRF)).status).toBe(204);

    expect((await laptop.get('/api/account')).status).toBe(401);
    expect((await laptop.post('/api/auth/refresh')).status).toBe(403);
  });
});

describe('אישור גישה על ידי מנהל', () => {
  it('משתמש ממתין לא מקבל סשן; סיסמה שגויה לא חושפת שהוא ממתין', async () => {
    await request(app).post('/api/auth/register').send({ name: 'ממתין', email: 'pend1@test.com', password: PASS });

    const ok = await request(app).post('/api/auth/login').send({ email: 'pend1@test.com', password: PASS });
    expect(ok.status).toBe(403);
    expect(ok.body.code).toBe('PENDING_APPROVAL');
    expect((ok.headers['set-cookie'] || []).join(';')).not.toContain('jwt=');

    const bad = await request(app).post('/api/auth/login').send({ email: 'pend1@test.com', password: 'nope-nope' });
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBeUndefined();
  });

  it('מנהל מקבל התראה, מאשר — והמשתמש מתחבר', async () => {
    const admin = await makeAdmin('admin1@test.com');
    await request(app).post('/api/auth/register').send({ name: 'חדש', email: 'pend2@test.com', password: PASS });
    const pending = await User.findOne({ email: 'pend2@test.com' });

    const adminDoc = await User.findOne({ email: 'admin1@test.com' });
    const alert = await Alert.findOne({ user: adminDoc._id, type: 'access_request', relatedId: pending._id });
    expect(alert).toBeTruthy();

    const list = await admin.get('/api/admin/users?status=pending');
    expect(list.status).toBe(200);
    expect(list.body.map((u) => u.email)).toContain('pend2@test.com');

    const approve = await admin.patch(`/api/admin/users/${pending._id}/approval`).set(CSRF).send({ decision: 'approve' });
    expect(approve.status).toBe(200);
    expect(approve.body.approvalStatus).toBe('approved');

    const login = await request(app).post('/api/auth/login').send({ email: 'pend2@test.com', password: PASS });
    expect(login.status).toBe(200);
  });

  it('דחייה של משתמש פעיל מנתקת את הסשן הקיים שלו', async () => {
    const admin = await makeAdmin('admin2@test.com');
    const victim = request.agent(app);
    await registerApproved(victim, { email: 'active1@test.com' });
    const doc = await User.findOne({ email: 'active1@test.com' });

    const reject = await admin.patch(`/api/admin/users/${doc._id}/approval`).set(CSRF).send({ decision: 'reject' });
    expect(reject.status).toBe(200);

    expect((await victim.post('/api/auth/refresh')).status).toBe(403);
    const login = await request(app).post('/api/auth/login').send({ email: 'active1@test.com', password: PASS });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe('ACCESS_REJECTED');
  });

  it('משתמש רגיל לא יכול לאשר בקשות', async () => {
    const plain = request.agent(app);
    await registerApproved(plain, { email: 'plain2@test.com' });
    await request(app).post('/api/auth/register').send({ name: 'x', email: 'pend3@test.com', password: PASS });
    const pending = await User.findOne({ email: 'pend3@test.com' });

    const res = await plain.patch(`/api/admin/users/${pending._id}/approval`).set(CSRF).send({ decision: 'approve' });
    expect(res.status).toBe(403);
    expect((await User.findById(pending._id)).approvalStatus).toBe('pending');
  });

  it('חסימה מנתקת מיד גם את ה-access token הפעיל (לא רק את ה-refresh)', async () => {
    const admin = await makeAdmin('admin3@test.com');
    const victim = request.agent(app);
    await registerApproved(victim, { email: 'active2@test.com' });
    expect((await victim.get('/api/transactions')).status).toBe(200);
    const doc = await User.findOne({ email: 'active2@test.com' });
    await admin.patch(`/api/admin/users/${doc._id}/approval`).set(CSRF).send({ decision: 'reject' });
    expect((await victim.get('/api/transactions')).status).toBe(401);
  });

  it('השתלטות דרך הרשמה מוקדמת: כניסת Google של בעל המייל מבטלת את הסיסמה של מי שנרשם', async () => {
    const prevId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    // Attacker pre-registers the victim's address (pending, unverified), and gets approved.
    await registerApproved(request.agent(app), { email: 'victim@gmail.test', password: PASS });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const body = String(url).includes('tokeninfo')
        ? { aud: process.env.GOOGLE_CLIENT_ID }
        : { sub: 'google-sub-1', email: 'victim@gmail.test', name: 'Victim', email_verified: true };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    try {
      const g = await request(app).post('/api/auth/google').send({ access_token: 'tok' });
      expect(g.status).toBe(200);
      const attacker = await request(app).post('/api/auth/login').send({ email: 'victim@gmail.test', password: PASS });
      expect(attacker.status).toBe(401);
    } finally {
      fetchSpy.mockRestore();
      process.env.GOOGLE_CLIENT_ID = prevId;
    }
  });

  it('משתמש שנוצר לפני מנגנון האישור (בלי השדה) נחשב מאושר', async () => {
    await registerApproved(request.agent(app), { email: 'legacy@test.com' });
    await User.collection.updateOne({ email: 'legacy@test.com' }, { $unset: { approvalStatus: '' } });
    const login = await request(app).post('/api/auth/login').send({ email: 'legacy@test.com', password: PASS });
    expect(login.status).toBe(200);
  });
});

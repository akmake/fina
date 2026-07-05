import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { __resetScrapeResult, __setScrapeResult } from './stubs/israeli-bank-scrapers.js';

const CSRF = { 'X-Fina-Client': 'web-app' };

async function registerAgent(email) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: 'בודק', email, password: 'Str0ngPass!' });
  expect(res.status).toBe(201);
  return agent;
}

// Poll a job until it reaches a terminal state (or time out).
async function waitForJob(agent, jobId, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const res = await agent.get(`/api/connections/jobs/${jobId}`);
    expect(res.status).toBe(200);
    if (['success', 'error', 'partial'].includes(res.body.status)) return res.body;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('job did not finish in time');
}

async function createLeumi(agent, displayName = 'הלאומי שלי') {
  return agent
    .post('/api/connections')
    .set(CSRF)
    .send({ company: 'leumi', username: 'user1', password: 'pass1', displayName });
}

beforeEach(() => { __resetScrapeResult(); });

describe('BankConnection — יצירה ואבטחת סודות', () => {
  it('יוצר חיבור ולא מחזיר לעולם את פרטי ההתחברות', async () => {
    const agent = await registerAgent('conn-a@test.com');
    const res = await createLeumi(agent);

    expect(res.status).toBe(201);
    expect(res.body.company).toBe('leumi');
    expect(res.body.displayName).toBe('הלאומי שלי');
    expect(res.body.status).toBe('active');
    // הסודות אף פעם לא נחשפים
    expect(res.body.credentials).toBeUndefined();
    expect(res.body.otpLongTermToken).toBeUndefined();
  });

  it('דוחה חברה לא נתמכת', async () => {
    const agent = await registerAgent('conn-bad@test.com');
    const res = await agent.post('/api/connections').set(CSRF).send({ company: 'notabank', username: 'x', password: 'y' });
    expect(res.status).toBe(400);
  });

  it('דוחה שדה חובה חסר', async () => {
    const agent = await registerAgent('conn-missing@test.com');
    const res = await agent.post('/api/connections').set(CSRF).send({ company: 'leumi', username: 'only-user' });
    expect(res.status).toBe(400);
  });

  it('GET /api/connections מחזיר רק חיבורים של המשתמש, בלי סודות', async () => {
    const agent = await registerAgent('conn-list@test.com');
    await createLeumi(agent);
    const res = await agent.get('/api/connections');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].credentials).toBeUndefined();
  });
});

describe('BankConnection — סנכרון אסינכרוני מקצה לקצה', () => {
  it('סנכרון ידני מייבא עסקאות ומעדכן את סטטוס החיבור', async () => {
    const agent = await registerAgent('conn-sync@test.com');
    const conn = await createLeumi(agent);
    const connId = conn.body._id;

    const sync = await agent.post(`/api/connections/${connId}/sync`).set(CSRF);
    expect(sync.status).toBe(202);
    expect(sync.body.jobId).toBeTruthy();

    const job = await waitForJob(agent, sync.body.jobId);
    expect(job.status).toBe('success');
    expect(job.stats.inserted).toBeGreaterThanOrEqual(1);

    // העסקה מהסקרייפר (stub) הגיעה למסד
    const txns = await agent.get('/api/transactions');
    expect(txns.status).toBe(200);
    expect(txns.body.some((t) => t.description === 'סופרמרקט הבדיקה')).toBe(true);

    // סטטוס החיבור מתעדכן
    const list = await agent.get('/api/connections');
    expect(list.body[0].lastSyncStatus).toBe('success');
    expect(list.body[0].lastInserted).toBeGreaterThanOrEqual(1);
  });

  it('סנכרון שני מדלג על עסקאות שכבר קיימות', async () => {
    const agent = await registerAgent('conn-dupe@test.com');
    const conn = await createLeumi(agent);
    const connId = conn.body._id;

    const first = await agent.post(`/api/connections/${connId}/sync`).set(CSRF);
    const firstJob = await waitForJob(agent, first.body.jobId);
    expect(firstJob.stats.inserted).toBeGreaterThanOrEqual(1);

    const second = await agent.post(`/api/connections/${connId}/sync`).set(CSRF);
    const secondJob = await waitForJob(agent, second.body.jobId);
    expect(secondJob.status).toBe('success');
    expect(secondJob.stats.inserted).toBe(0);
    expect(secondJob.stats.skipped).toBeGreaterThanOrEqual(1);
  });

  it('כשל בסקרייפר מסמן את החיבור כשגוי', async () => {
    const agent = await registerAgent('conn-fail@test.com');
    const conn = await createLeumi(agent);
    __setScrapeResult({ success: false, errorType: 'invalidPassword' });

    const sync = await agent.post(`/api/connections/${conn.body._id}/sync`).set(CSRF);
    const job = await waitForJob(agent, sync.body.jobId);
    expect(job.status).toBe('error');

    const list = await agent.get('/api/connections');
    expect(list.body[0].status).toBe('error');
    expect(list.body[0].lastSyncStatus).toBe('error');
  });
});

describe('BankConnection — בידוד בין משתמשים', () => {
  it('משתמש ב לא רואה ולא יכול לסנכרן חיבור של משתמש א', async () => {
    const userA = await registerAgent('conn-iso-a@test.com');
    const userB = await registerAgent('conn-iso-b@test.com');
    const conn = await createLeumi(userA, 'סודי של א');
    const connId = conn.body._id;

    const listB = await userB.get('/api/connections');
    expect(listB.body.some((c) => c._id === connId)).toBe(false);

    const syncB = await userB.post(`/api/connections/${connId}/sync`).set(CSRF);
    expect(syncB.status).toBe(404);

    const delB = await userB.delete(`/api/connections/${connId}`).set(CSRF);
    expect(delB.status).toBe(404);
  });
});

describe('BankConnection — מחיקה רכה', () => {
  it('מחיקה מסתירה את החיבור מהרשימה', async () => {
    const agent = await registerAgent('conn-del@test.com');
    const conn = await createLeumi(agent);

    const del = await agent.delete(`/api/connections/${conn.body._id}`).set(CSRF);
    expect(del.status).toBe(200);

    const list = await agent.get('/api/connections');
    expect(list.body).toHaveLength(0);
  });
});

describe('BankConnection — One Zero (טוקן OTP)', () => {
  it('יצירת חיבור One Zero דורשת טוקן, וסנכרון עובד איתו', async () => {
    const agent = await registerAgent('conn-oz@test.com');

    // בלי טוקן — נדחה
    const noToken = await agent.post('/api/connections').set(CSRF)
      .send({ company: 'oneZero', email: 'a@b.com', password: 'p' });
    expect(noToken.status).toBe(400);

    // עם טוקן — נוצר
    const created = await agent.post('/api/connections').set(CSRF)
      .send({ company: 'oneZero', email: 'a@b.com', password: 'p', otpLongTermToken: 'long-term-token' });
    expect(created.status).toBe(201);

    const sync = await agent.post(`/api/connections/${created.body._id}/sync`).set(CSRF);
    const job = await waitForJob(agent, sync.body.jobId);
    expect(job.status).toBe('success');
  });
});

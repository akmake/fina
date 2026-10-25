import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// CAL is reached over HTTP — stub the network calls, keep the row conversion real.
vi.mock('../services/calService.js', async (importOriginal) => {
  const actual = await importOriginal();
  const { default: AppError } = await import('../utils/AppError.js');
  return {
    ...actual,
    requestCalOtp: vi.fn(async () => ({ uuid: 'cal-session-uuid', maskedPhone: '05*-***-1234' })),
    verifyCalOtp: vi.fn(async ({ otp }) => {
      if (otp !== '482913') throw Object.assign(new AppError('קוד שגוי או פג תוקף', 422), { code: 'OTP_INVALID' });
      return 'cal-auth-token';
    }),
    fetchCalAccounts: vi.fn(async () => [{
      accountNumber: '1234',
      cardType: 'כאל',
      txns: [{
        date: '2026-10-20T10:00:00.000Z', processedDate: '2026-11-02T00:00:00.000Z',
        description: 'קפה הבדיקה', memo: '', originalAmount: -18, originalCurrency: 'ILS',
        chargedAmount: -18, status: 'completed', type: 'normal', identifier: 'cal-1',
      }],
    }]),
  };
});

const { default: app } = await import('../app.js');
const { registerApproved } = await import('./helpers.js');
const { runImportJob, expireStaleOtpJobs, extractOtp } = await import('../services/importRunner.js');
const { computeNextSyncAt } = await import('../services/importScheduler.js');
const { persistTransactions } = await import('../services/transactionPersistence.js');
const calService = await import('../services/calService.js');
const { default: ImportJob } = await import('../models/ImportJob.js');
const { default: BankConnection } = await import('../models/BankConnection.js');
const { default: Transaction } = await import('../models/Transaction.js');
const { default: Alert } = await import('../models/Alert.js');
const { default: User } = await import('../models/User.js');
const { __setScrapeResult, __resetScrapeResult } = await import('./stubs/israeli-bank-scrapers.js');
const { israelParts } = await import('../utils/israelTime.js');

const CSRF = { 'X-Fina-Client': 'web-app' };
const SMS = 'קוד האימות שלך לכניסה לכאל הוא 482913. אין להעביר קוד זה לאיש';

const userAgent = async (email) => {
  const agent = request.agent(app);
  const res = await registerApproved(agent, { email });
  expect(res.status).toBe(200);
  return { agent, user: res.body.user };
};

const createCalAuto = (agent, extra = {}) => agent.post('/api/connections').set(CSRF)
  .send({ company: 'calAuto', id: '123456789', last4: '1234', syncHour: 7, ...extra });

const pairDevice = async (agent) => {
  const res = await agent.post('/api/devices').set(CSRF).send({ name: 'הטלפון שלי' });
  expect(res.status).toBe(201);
  return res.body.token;
};

const startScheduledJob = async (connId) => {
  const conn = await BankConnection.findById(connId);
  const job = await ImportJob.create({ user: conn.user, connection: conn._id, company: conn.company, trigger: 'scheduled' });
  await runImportJob(job._id);
  return ImportJob.findById(job._id);
};

beforeEach(() => { __resetScrapeResult(); vi.clearAllMocks(); });

describe('תזמון יומי לפי שעון ישראל', () => {
  it('מחשב את המופע הבא של השעה שנבחרה (07:00 בישראל)', () => {
    const next = computeNextSyncAt(new Date('2026-10-25T06:00:00Z'), 7); // 08:00 IL → מחר
    const p = israelParts(next);
    expect(p.hour).toBe(7);
    expect(p.day).toBe(26);
  });

  it('חיבור נשמר עם שעת סנכרון ומועד הבא תואם', async () => {
    const { agent } = await userAgent('sched1@test.com');
    const res = await createCalAuto(agent);
    expect(res.status).toBe(201);
    expect(res.body.syncHour).toBe(7);
    expect(israelParts(new Date(res.body.nextSyncAt)).hour).toBe(7);

    const bad = await agent.patch(`/api/connections/${res.body._id}`).set(CSRF).send({ syncHour: 24 });
    expect(bad.status).toBe(400);
    const ok = await agent.patch(`/api/connections/${res.body._id}`).set(CSRF).send({ syncHour: 21 });
    expect(israelParts(new Date(ok.body.nextSyncAt)).hour).toBe(21);
  });
});

describe('כאל — קוד SMS שמגיע מהטלפון', () => {
  it('סנכרון מתוזמן ממתין לקוד; הטלפון שולח את ה-SMS והעסקאות נשמרות', async () => {
    const { agent } = await userAgent('cal1@test.com');
    const conn = await createCalAuto(agent);
    const token = await pairDevice(agent);

    const job = await startScheduledJob(conn.body._id);
    expect(job.status).toBe('awaiting_otp');
    expect(job.maskedPhone).toBe('05*-***-1234');
    expect(calService.requestCalOtp).toHaveBeenCalledWith({ id: '123456789', last4: '1234' });

    const hb = await request(app).post('/api/devices/heartbeat').set(CSRF).set('Authorization', `Device ${token}`);
    expect(hb.body.awaitingOtp).toBe(true);

    const res = await request(app).post('/api/devices/otp').set(CSRF)
      .set('Authorization', `Device ${token}`).send({ message: SMS, sender: 'CAL' });
    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(true);
    expect(res.body.status).toBe('success');
    expect(res.body.stats.inserted).toBe(1);

    const txns = await agent.get('/api/transactions');
    expect(txns.body.some((t) => t.description === 'קפה הבדיקה')).toBe(true);
    const saved = await BankConnection.findById(conn.body._id);
    expect(saved.lastSuccessAt).toBeTruthy();
    expect(israelParts(saved.nextSyncAt).hour).toBe(7);
  });

  it('קוד שגוי לא סוגר את הסנכרון — אפשר לנסות שוב מהאתר', async () => {
    const { agent } = await userAgent('cal2@test.com');
    const conn = await createCalAuto(agent);
    const job = await startScheduledJob(conn.body._id);

    const wrong = await agent.post(`/api/connections/jobs/${job._id}/otp`).set(CSRF).send({ code: '111111' });
    expect(wrong.status).toBe(422);
    expect((await ImportJob.findById(job._id)).status).toBe('awaiting_otp');

    const right = await agent.post(`/api/connections/jobs/${job._id}/otp`).set(CSRF).send({ code: '482913' });
    expect(right.status).toBe(200);
    expect(right.body.status).toBe('success');
    expect(right.body.otpSession).toBeUndefined();
  });

  it('קוד שלא הגיע בזמן — הסנכרון פג, החיבור נשאר פעיל, והמשתמש מקבל התראה', async () => {
    const { agent, user } = await userAgent('cal3@test.com');
    const conn = await createCalAuto(agent);
    const job = await startScheduledJob(conn.body._id);
    await ImportJob.updateOne({ _id: job._id }, { $set: { otpExpiresAt: new Date(Date.now() - 1000) } });

    expect(await expireStaleOtpJobs()).toBe(1);
    expect((await ImportJob.findById(job._id)).status).toBe('error');
    const saved = await BankConnection.findById(conn.body._id);
    expect(saved.status).toBe('active');
    expect(israelParts(saved.nextSyncAt).hour).toBe(7);
    expect(await Alert.exists({ user: user._id, type: 'bank_sync_failed' })).toBeTruthy();
  });

  it('לחיצה כפולה על "סנכרן" לא שולחת SMS שני', async () => {
    const { agent } = await userAgent('cal4@test.com');
    const conn = await createCalAuto(agent);
    const first = await agent.post(`/api/connections/${conn.body._id}/sync`).set(CSRF);
    expect(first.status).toBe(202);
    const second = await agent.post(`/api/connections/${conn.body._id}/sync`).set(CSRF);
    expect(second.status).toBe(409);
    expect(String(second.body.jobId)).toBe(String(first.body.jobId));
  });

  it('אחרי 3 קודים שגויים הסנכרון נעצר (לא נועלים את חשבון כאל)', async () => {
    const { agent } = await userAgent('cal5@test.com');
    const conn = await createCalAuto(agent);
    const job = await startScheduledJob(conn.body._id);

    expect((await agent.post(`/api/connections/jobs/${job._id}/otp`).set(CSRF).send({ code: '111111' })).status).toBe(422);
    expect((await agent.post(`/api/connections/jobs/${job._id}/otp`).set(CSRF).send({ code: '222222' })).status).toBe(422);
    const third = await agent.post(`/api/connections/jobs/${job._id}/otp`).set(CSRF).send({ code: '333333' });
    expect(third.status).toBe(429);
    expect((await ImportJob.findById(job._id)).status).toBe('error');
    expect(calService.verifyCalOtp).toHaveBeenCalledTimes(3);
  });

  it('job שנתקע ב-running (קריסת שרת) נסגר ולא חוסם סנכרון חדש', async () => {
    const { expireStuckJobs } = await import('../services/importRunner.js');
    const { agent } = await userAgent('cal6@test.com');
    const conn = await createCalAuto(agent);
    const old = new Date(Date.now() - 60 * 60 * 1000);
    const stuck = await ImportJob.create({ user: (await BankConnection.findById(conn.body._id)).user, connection: conn.body._id, company: 'calAuto', status: 'running', startedAt: old });
    expect(await expireStuckJobs()).toBe(1);
    expect((await ImportJob.findById(stuck._id)).status).toBe('error');
  });

  it('Relay webhook (אפליקציית AppSms): Bearer, בלי כותרת CSRF; SMS שאינו מכאל לא נוגע בסנכרון', async () => {
    const { agent } = await userAgent('relay1@test.com');
    const conn = await createCalAuto(agent);
    const token = await pairDevice(agent);
    const job = await startScheduledJob(conn.body._id);

    // Unrelated SMS (another service's code) — ignored, no attempt at CAL.
    const other = await request(app).post('/api/devices/sms').set('Authorization', `Bearer ${token}`)
      .send({ id: '1', from: 'AliExpress', body: 'Your code is 777777', receivedAt: Date.now(), platform: 'android' });
    expect(other.status).toBe(200);
    expect(other.body).toMatchObject({ handled: false, reason: 'not-a-cal-sms' });
    expect(calService.verifyCalOtp).not.toHaveBeenCalled();
    expect((await ImportJob.findById(job._id)).status).toBe('awaiting_otp');

    const cal = await request(app).post('/api/devices/sms').set('Authorization', `Bearer ${token}`)
      .send({ id: '2', from: 'CAL', body: SMS, receivedAt: Date.now(), platform: 'android' });
    expect(cal.status).toBe(200);
    expect(cal.body).toMatchObject({ handled: true, status: 'success', inserted: 1 });

    const bad = await request(app).post('/api/devices/sms').set('Authorization', 'Bearer fd_nope').send({ from: 'CAL', body: SMS });
    expect(bad.status).toBe(401);
  });

  it('extractOtp מוציא את הקוד מתוך הודעה מלאה', () => {
    expect(extractOtp(SMS)).toBe('482913');
    expect(extractOtp('  654321 ')).toBe('654321');
    expect(extractOtp('אין כאן קוד')).toBeNull();
  });
});

describe('טוקן מכשיר — הרשאה מינימלית', () => {
  it('טוקן מכשיר לא קורא נתונים; מכשיר מבוטל נדחה; בלי סנכרון ממתין → 404', async () => {
    const { agent } = await userAgent('dev1@test.com');
    const token = await pairDevice(agent);

    const read = await request(app).get('/api/transactions').set('Authorization', `Device ${token}`);
    expect(read.status).toBe(401);

    const nothing = await request(app).post('/api/devices/otp').set(CSRF)
      .set('Authorization', `Device ${token}`).send({ code: '482913' });
    expect(nothing.status).toBe(404);
    expect(nothing.body.matched).toBe(false);

    const list = await agent.get('/api/devices');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].tokenHash).toBeUndefined();
    await agent.delete(`/api/devices/${list.body[0]._id}`).set(CSRF);

    const revoked = await request(app).post('/api/devices/heartbeat').set(CSRF).set('Authorization', `Device ${token}`);
    expect(revoked.status).toBe(401);
  });

  it('מכשיר של משתמש שנחסם מפסיק לעבוד', async () => {
    const { agent, user } = await userAgent('dev2@test.com');
    const token = await pairDevice(agent);
    await User.updateOne({ _id: user._id }, { $set: { approvalStatus: 'rejected' } });
    const res = await request(app).post('/api/devices/heartbeat').set(CSRF).set('Authorization', `Device ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('אמינות הסנכרון', () => {
  it('תקלה זמנית בסנכרון מתוזמן לא מכבה את החיבור — ניסיון חוזר בעוד כחצי שעה', async () => {
    const { agent } = await userAgent('rel1@test.com');
    const conn = await agent.post('/api/connections').set(CSRF)
      .send({ company: 'leumi', username: 'u', password: 'p' });
    __setScrapeResult({ success: false, errorType: 'timeout' });

    const before = Date.now();
    const job = await startScheduledJob(conn.body._id);
    expect(job.status).toBe('error');

    const saved = await BankConnection.findById(conn.body._id);
    expect(saved.status).toBe('active');
    expect(saved.consecutiveFailures).toBe(1);
    const delay = saved.nextSyncAt.getTime() - before;
    expect(delay).toBeGreaterThan(25 * 60 * 1000);
    expect(delay).toBeLessThan(35 * 60 * 1000);
  });

  it('עסקה שנמחקה לא חוזרת בסנכרון הבא', async () => {
    const { user } = await userAgent('rel2@test.com');
    const tx = {
      date: new Date('2026-10-10T08:00:00Z'), description: 'מנוי נמחק', amount: 49.9,
      type: 'הוצאה', category: 'כללי', account: 'checking',
    };
    const first = await persistTransactions({ userId: user._id, transactions: [tx] });
    expect(first.inserted).toBe(1);

    await Transaction.softDeleteOne({ user: user._id, description: 'מנוי נמחק' });
    // Unattended bank sync: the deleted row stays deleted.
    const second = await persistTransactions({ userId: user._id, transactions: [tx], includeDeleted: true });
    expect(second.inserted).toBe(0);
    expect(await Transaction.countDocuments({ user: user._id, description: 'מנוי נמחק' })).toBe(0);
    // Manual re-import of a file (e.g. after 'delete all') still brings it back.
    const manual = await persistTransactions({ userId: user._id, transactions: [tx] });
    expect(manual.inserted).toBe(1);
  });

  it('מחיקת חשבון מוחקת פרטי בנק שמורים ומבטלת טלפונים מצומדים', async () => {
    const { agent } = await userAgent('rel4@test.com');
    const conn = await createCalAuto(agent);
    const token = await pairDevice(agent);
    const del = await agent.delete('/api/account').set(CSRF).send({ password: 'Str0ngPass!' });
    expect(del.status).toBe(200);
    const mongoose = (await import('mongoose')).default;
    const raw = await BankConnection.collection.findOne({ _id: new mongoose.Types.ObjectId(conn.body._id) });
    expect(raw.credentials).toBeUndefined();
    const hb = await request(app).post('/api/devices/heartbeat').set(CSRF).set('Authorization', `Device ${token}`);
    expect(hb.status).toBe(401);
  });

  it('ניתוק חיבור מוחק את פרטי ההתחברות השמורים', async () => {
    const { agent } = await userAgent('rel3@test.com');
    const conn = await createCalAuto(agent);
    await agent.delete(`/api/connections/${conn.body._id}`).set(CSRF);
    const raw = await BankConnection.collection.findOne({ _id: new (await import('mongoose')).default.Types.ObjectId(conn.body._id) });
    expect(raw.credentials).toBeUndefined();
    expect(raw.deletedAt).toBeTruthy();
  });
});

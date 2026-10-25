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

// A sync already waiting the old way (server-run, code relayed to the server).
const legacyServerJob = async (connId) => {
  const { encrypt } = await import('../utils/crypto.js');
  const conn = await BankConnection.findById(connId);
  return ImportJob.create({
    user: conn.user, connection: conn._id, company: conn.company, trigger: 'scheduled', status: 'awaiting_otp',
    otpRequestedAt: new Date(), otpExpiresAt: new Date(Date.now() + 600000), otpSession: encrypt('cal-session-uuid'),
  });
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

describe('כאל — הסנכרון רץ דרך הטלפון (כאל חוסמת את כתובת השרת)', () => {
  const step = (token, body = {}) => request(app).post('/api/devices/cal/step').set('Authorization', 'Bearer ' + token).send(body);
  const answer = (prev, status, json) => ({ jobId: prev.jobId, seq: prev.seq, response: { status, body: typeof json === 'string' ? json : JSON.stringify(json) } });
  const INIT = { result: { cards: [{ cardUniqueId: 'card-1', last4Digits: '1234', companyDescription: 'כאל' }], bankAccounts: [{ bankAccountUniqueID: 'ba-1' }] } };
  const TXNS = { result: { transArr: [{ cardUniqueId: 'card-1', trnAmt: 18, trnPurchaseDate: '2026-10-20T10:00:00', merchantName: 'קפה הבדיקה', trnTypeCode: '5', trnIntId: 991 }] } };
  const PENDING = { result: { cardsList: [{ authDetalisList: [{ trnAmt: 30, trnPurchaseDate: '2026-10-24T09:00:00', merchantName: 'עסקה ממתינה' }] }] } };

  it('מסלול מלא: הטלפון מבקש קוד, מקבל SMS, נכנס לכאל ומעביר את הנתונים — העסקאות נשמרות', async () => {
    const { agent } = await userAgent('cal1@test.com');
    const conn = await createCalAuto(agent);
    const token = await pairDevice(agent);

    const job = await startScheduledJob(conn.body._id);
    expect(job).toMatchObject({ status: 'awaiting_otp', runsOn: 'device', deviceStage: 'waiting_phone' });
    expect(calService.requestCalOtp).not.toHaveBeenCalled(); // the server never calls CAL
    expect((await request(app).post('/api/devices/heartbeat').set('Authorization', 'Bearer ' + token)).body.calTask).toBe(true);

    const otp = (await step(token)).body;
    expect(otp.action).toBe('http');
    expect(otp.request).toMatchObject({ method: 'PUT', body: { userId: '123456789', last4Digits: '1234' } });
    expect(new URL(otp.request.url).hostname).toMatch(/\.cal-online\.co\.il$/);

    const wait = (await step(token, answer(otp, 200, { token: 'cal-uuid', phoneNumber: '05*-***-1234' }))).body;
    expect(wait.action).toBe('wait_sms');
    const listed = (await agent.get('/api/connections')).body.find((c) => c._id === conn.body._id);
    expect(listed.pendingOtpJob).toMatchObject({ runsOn: 'device', deviceStage: 'waiting_sms', maskedPhone: '05*-***-1234' });

    // The code is used on the phone — never server-side (relay / web box).
    expect((await request(app).post('/api/devices/sms').set('Authorization', 'Bearer ' + token).send({ from: 'CalLogin', body: SMS })).body.reason).toBe('no-sync-waiting');
    expect((await agent.post(`/api/connections/jobs/${job._id}/otp`).set(CSRF).send({ code: '482913' })).status).toBe(409);

    // A wrong code (CAL 401) → wait for the next SMS.
    let verify = (await step(token, { jobId: wait.jobId, seq: wait.seq, code: SMS })).body;
    expect(verify.request.body).toMatchObject({ custID: '123456789', password: '482913', token: 'cal-uuid' });
    const again = (await step(token, answer(verify, 401, { message: 'bad' }))).body;
    expect(again.action).toBe('wait_sms');
    verify = (await step(token, { jobId: again.jobId, seq: again.seq, code: '482913' })).body;

    const init = (await step(token, answer(verify, 200, { token: 'auth-1' }))).body;
    expect(init.request.headers.Authorization).toBe('CALAuthScheme auth-1');
    const txns = (await step(token, answer(init, 200, INIT))).body;
    expect(txns.request.body.cards).toEqual([{ cardUniqueID: 'card-1' }]);
    const pending = (await step(token, answer(txns, 200, TXNS))).body;
    expect(pending.request.body).toEqual({ cardUniqueIDArray: ['card-1'] });
    const done = (await step(token, answer(pending, 200, PENDING))).body;
    expect(done).toMatchObject({ action: 'done', ok: true });

    const saved = await ImportJob.findById(job._id).select('+deviceState');
    expect(saved.status).toBe('success');
    expect(saved.stats.inserted).toBe(2);
    expect(saved.deviceState).toBeUndefined();
    const all = (await agent.get('/api/transactions')).body.map((t) => t.description);
    expect(all).toEqual(expect.arrayContaining(['קפה הבדיקה', 'עסקה ממתינה']));
    expect((await BankConnection.findById(conn.body._id)).lastSuccessAt).toBeTruthy();

    // A replayed (stale) answer is refused; nothing more to pick up.
    expect((await step(token, answer(pending, 200, PENDING))).status).toBe(409);
    expect((await step(token)).body).toEqual({ action: 'none' });
  });

  it('כאל דוחה את הפרטים (JSON 400) → החיבור במצב שגיאה; חסימה (HTML 403) → זמני, החיבור נשאר פעיל', async () => {
    const { agent } = await userAgent('cal2@test.com');
    const conn = await createCalAuto(agent);
    const token = await pairDevice(agent);

    await startScheduledJob(conn.body._id);
    const blocked = (await step(token, answer((await step(token)).body, 403, '<html>Access denied</html>'))).body;
    expect(blocked).toMatchObject({ action: 'done', ok: false });
    expect(blocked.message).toMatch(/לא בעיה בפרטים/);
    expect((await BankConnection.findById(conn.body._id)).status).toBe('active');

    await startScheduledJob(conn.body._id);
    const wrong = (await step(token, answer((await step(token)).body, 400, { message: 'פרטים שגויים' }))).body;
    expect(wrong).toMatchObject({ action: 'done', ok: false, message: 'פרטים שגויים' });
    expect((await BankConnection.findById(conn.body._id)).status).toBe('error');
  });

  it('בלי טלפון מצומד — הסנכרון נכשל עם הסבר והחיבור נשאר פעיל', async () => {
    const { agent } = await userAgent('cal3@test.com');
    const conn = await createCalAuto(agent);
    const job = await startScheduledJob(conn.body._id);
    expect(job.status).toBe('error');
    expect(job.error).toMatch(/אין טלפון מצומד/);
    expect((await BankConnection.findById(conn.body._id)).status).toBe('active');
  });

  it('הטלפון לא התחבר בזמן — הסנכרון פג, החיבור נשאר פעיל, והמשתמש מקבל התראה', async () => {
    const { agent, user } = await userAgent('cal4@test.com');
    const conn = await createCalAuto(agent);
    await pairDevice(agent);
    const job = await startScheduledJob(conn.body._id);
    await ImportJob.updateOne({ _id: job._id }, { $set: { otpExpiresAt: new Date(Date.now() - 1000) } });

    expect(await expireStaleOtpJobs()).toBe(1);
    const expired = await ImportJob.findById(job._id);
    expect(expired.status).toBe('error');
    expect(expired.error).toMatch(/הטלפון לא התחבר/);
    const saved = await BankConnection.findById(conn.body._id);
    expect(saved.status).toBe('active');
    expect(israelParts(saved.nextSyncAt).hour).toBe(7);
    expect(await Alert.exists({ user: user._id, type: 'bank_sync_failed' })).toBeTruthy();
  });

  it('לחיצה כפולה על "סנכרן" לא פותחת סנכרון שני', async () => {
    const { agent } = await userAgent('cal5@test.com');
    const conn = await createCalAuto(agent);
    await pairDevice(agent);
    const first = await agent.post(`/api/connections/${conn.body._id}/sync`).set(CSRF);
    expect(first.status).toBe(202);
    await new Promise((r) => setTimeout(r, 50));
    const second = await agent.post(`/api/connections/${conn.body._id}/sync`).set(CSRF);
    expect(second.status).toBe(409);
    expect(String(second.body.jobId)).toBe(String(first.body.jobId));
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

  it('Relay webhook (אפליקציית AppSms): Bearer, בלי CSRF; מאשר מיד ומסיים ברקע; SMS שאינו מכאל לא נוגע בסנכרון', async () => {
    const { agent } = await userAgent('relay1@test.com');
    const conn = await createCalAuto(agent);
    const token = await pairDevice(agent);
    const job = await legacyServerJob(conn.body._id);
    const sms = (body) => request(app).post('/api/devices/sms').set('Authorization', 'Bearer ' + token)
      .send({ id: '1', from: 'CAL', body, receivedAt: Date.now(), platform: 'android' });

    // Another service's code, and a CAL message without a code — ignored, no attempt at CAL.
    const other = await request(app).post('/api/devices/sms').set('Authorization', 'Bearer ' + token)
      .send({ id: '1', from: 'AliExpress', body: 'Your code is 777777', receivedAt: Date.now(), platform: 'android' });
    expect(other.status).toBe(200);
    expect(other.body).toMatchObject({ handled: false, reason: 'not-a-cal-sms' });
    expect((await sms('כאל: הצטרפו עכשיו למועדון')).body).toMatchObject({ handled: false, reason: 'no-code' });
    expect(calService.verifyCalOtp).not.toHaveBeenCalled();
    expect((await ImportJob.findById(job._id)).status).toBe('awaiting_otp');

    // The real code: acknowledged immediately; the sync finishes in the background.
    const cal = await sms(SMS);
    expect(cal.status).toBe(200);
    expect(cal.body).toMatchObject({ handled: true, accepted: true });
    for (let i = 0; i < 60 && (await ImportJob.findById(job._id)).status !== 'success'; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect((await ImportJob.findById(job._id)).status).toBe('success');

    const bad = await request(app).post('/api/devices/sms').set('Authorization', 'Bearer fd_nope').send({ from: 'CAL', body: SMS });
    expect(bad.status).toBe(401);
  });

  it('Relay: ה-SMS הקדים את השרת (הסנכרון מתחיל, עוד לא ממתין לקוד) → 425 כדי שהטלפון ינסה שוב', async () => {
    const { agent } = await userAgent('relay2@test.com');
    const conn = await createCalAuto(agent);
    const token = await pairDevice(agent);
    const connDoc = await BankConnection.findById(conn.body._id);
    await ImportJob.create({ user: connDoc.user, connection: connDoc._id, company: 'calAuto', trigger: 'scheduled', status: 'running', startedAt: new Date() });

    const early = await request(app).post('/api/devices/sms').set('Authorization', 'Bearer ' + token)
      .send({ id: '1', from: 'CAL', body: SMS, receivedAt: Date.now(), platform: 'android' });
    expect(early.status).toBe(425);
    expect(early.body).toMatchObject({ handled: false, reason: 'sync-starting', retry: true });
    expect(calService.verifyCalOtp).not.toHaveBeenCalled();

    // Nothing is starting at all (e.g. the user logged in to CAL themselves) → plain 200, no retry.
    await ImportJob.deleteMany({ connection: connDoc._id });
    const none = await request(app).post('/api/devices/sms').set('Authorization', 'Bearer ' + token)
      .send({ id: '2', from: 'CAL', body: SMS, receivedAt: Date.now(), platform: 'android' });
    expect(none.status).toBe(200);
    expect(none.body).toMatchObject({ handled: false, reason: 'no-sync-waiting' });
  });

  it('Relay: heartbeat עם Bearer בלבד (בלי כותרת CSRF) מזהה את המכשיר', async () => {
    const { agent } = await userAgent('relay3@test.com');
    const token = await pairDevice(agent);
    const ok = await request(app).post('/api/devices/heartbeat').set('Authorization', 'Bearer ' + token);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ ok: true, awaitingOtp: false, deviceName: 'הטלפון שלי' });
    expect((await request(app).post('/api/devices/heartbeat').set('Authorization', 'Bearer fd_nope')).status).toBe(401);
    expect((await request(app).post('/api/devices/heartbeat')).status).toBe(401);
  });

  it('זיהוי SMS של כאל: מילה שלמה בעברית (עם תחילית), לא "כאלה"', async () => {
    const { looksLikeCalSms } = await import('../controllers/deviceController.js');
    for (const [from, body] of [['CAL', ''], ['VisaCal', 'x'], ['+97250', 'קוד האימות שלך בכאל: 123456'], ['', 'ויזה כאל']]) {
      expect(looksLikeCalSms(from, body)).toBe(true);
    }
    for (const [from, body] of [['Shop', 'calendar invite'], ['Dad', 'יש לי כאלה וכאלה'], ['Bank', 'your code 123456']]) {
      expect(looksLikeCalSms(from, body)).toBe(false);
    }
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

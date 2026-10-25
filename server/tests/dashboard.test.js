import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { registerApproved } from './helpers.js';
import { persistTransactions } from '../services/transactionPersistence.js';
import { israelMonthStart } from '../utils/israelTime.js';

const CSRF = { 'X-Fina-Client': 'web-app' };

const userAgent = async (email) => {
  const agent = request.agent(app);
  const res = await registerApproved(agent, { email });
  return { agent, user: res.body.user };
};

const tx = (date, amount, description, type = 'הוצאה') =>
  ({ date, amount, description, type, category: 'כללי', account: 'checking' });

describe('דשבורד — חודש לפי שעון ישראל', () => {
  it('הוצאות "החודש" כוללות עסקה מתחילת החודש בישראל, וחודש קודם לא ריק', async () => {
    const { agent, user } = await userAgent('dash1@test.com');
    const monthStart = israelMonthStart(new Date());
    // 00:30 in Israel on the 1st — the UTC date is still the previous month.
    const firstOfMonth = new Date(monthStart.getTime() + 30 * 60 * 1000);
    const lastMonth = new Date(israelMonthStart(new Date(), -1).getTime() + 5 * 24 * 60 * 60 * 1000);
    await persistTransactions({ userId: user._id, transactions: [
      tx(firstOfMonth, 100, 'קפה של חצות'),
      tx(lastMonth, 40, 'חודש שעבר'),
    ] });

    const res = await agent.get('/api/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.monthlySummary.thisMonth.expense).toBe(100);
    expect(res.body.monthlySummary.prevMonth.expense).toBe(40);
  });
});

describe('דשבורד — מה חדש מאז הביקור הקודם', () => {
  it('מציג עסקאות חדשות, חיבורים והתראות; רענון באותו ביקור לא מאפס', async () => {
    const { agent, user } = await userAgent('dash2@test.com');
    await agent.post('/api/connections').set(CSRF).send({ company: 'leumi', username: 'u', password: 'p', syncHour: 7 });
    await persistTransactions({ userId: user._id, transactions: [tx(new Date(), 55, 'סופר')] });

    const first = await agent.get('/api/dashboard/updates');
    expect(first.status).toBe(200);
    expect(first.body.isFirstVisit).toBe(true);
    expect(first.body.newTransactions.count).toBe(1);
    expect(first.body.newTransactions.expense).toBe(55);
    expect(first.body.connections).toHaveLength(1);
    expect(first.body.connections[0].syncHour).toBe(7);
    expect(first.body.connections[0].credentials).toBeUndefined();

    const again = await agent.get('/api/dashboard/updates');
    expect(again.body.newTransactions.count).toBe(1);

    // Next visit (last one an hour ago, the transaction arrived before it):
    // a new window that only shows what arrived since that visit.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await Transaction.collection.updateMany({ user: new mongoose.Types.ObjectId(user._id) },
      { $set: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    await User.updateOne({ _id: user._id }, { $set: { dashboardVisitAt: hourAgo } });
    const next = await agent.get('/api/dashboard/updates');
    expect(next.body.isFirstVisit).toBe(false);
    expect(new Date(next.body.since).getTime()).toBe(hourAgo.getTime());
    expect(next.body.newTransactions.count).toBe(0);
  });

  it('מנהל רואה כמה בקשות הצטרפות ממתינות', async () => {
    const { agent } = await userAgent('dash-admin@test.com');
    await User.updateOne({ email: 'dash-admin@test.com' }, { $set: { role: 'admin' } });
    await request(app).post('/api/auth/register').send({ name: 'מבקש', email: 'dash-pend@test.com', password: 'Str0ngPass!' });
    const res = await agent.get('/api/dashboard/updates');
    expect(res.body.pendingApprovals).toBeGreaterThanOrEqual(1);
  });
});

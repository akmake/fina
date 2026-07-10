import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Alert from '../models/Alert.js';
import { notify, notifyMany } from '../services/notificationService.js';

const makeUser = (email) => User.create({ name: 'בודק', email, passwordHash: 'x'.repeat(60) });

describe('מנוע התראות (notificationService) — שלב 3', () => {
  beforeEach(async () => {
    await Alert.deleteMany({});
  });

  it('notify יוצר התראה in-app עם ערוצים ו-dedupeKey', async () => {
    const user = await makeUser('notif-1@test.com');
    const res = await notify({
      user: user._id,
      type: 'budget_warning',
      title: 'אזהרת תקציב: מזון',
      message: 'הגעת ל-90% מהתקציב',
      channels: ['inapp'],
      dedupeKey: 'budget:מזון:2026-07',
    });
    expect(res.created).toBe(true);
    expect(res.alert.channels).toContain('inapp');
    expect(res.alert.dedupeKey).toBe('budget:מזון:2026-07');
    expect(await Alert.countDocuments({ user: user._id })).toBe(1);
  });

  it('קריאה שנייה עם אותו dedupeKey לא יוצרת כפילות', async () => {
    const user = await makeUser('notif-2@test.com');
    const payload = {
      user: user._id, type: 'budget_exceeded', title: 'חריגה',
      dedupeKey: 'budget:רכב:2026-07',
    };
    const first = await notify(payload);
    const second = await notify(payload);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.reason).toBe('deduped');
    expect(await Alert.countDocuments({ user: user._id })).toBe(1);
  });

  it('התראה שנדחתה (dismissed) לא חוסמת יצירה מחדש', async () => {
    const user = await makeUser('notif-3@test.com');
    const payload = { user: user._id, type: 'bank_sync_failed', title: 'נכשל', dedupeKey: 'sync:x' };
    const first = await notify(payload);
    await Alert.updateOne({ _id: first.alert._id }, { isDismissed: true });
    const second = await notify(payload);
    expect(second.created).toBe(true);
  });

  it('ערוץ email לא מסומן כנשלח כשאין ספק דואר מוגדר', async () => {
    const user = await makeUser('notif-4@test.com');
    const res = await notify({
      user: user._id, type: 'general', title: 'בדיקה',
      channels: ['inapp', 'email'], dedupeKey: 'email:test',
    });
    expect(res.created).toBe(true);
    expect(res.alert.emailSentAt).toBeFalsy(); // EMAIL_ENABLED לא מוגדר → לא נשלח
  });

  it('notify דורש user/type/title', async () => {
    await expect(notify({ type: 'general', title: 'x' })).rejects.toThrow();
  });

  it('notifyMany סופר רק את מה שנוצר בפועל', async () => {
    const user = await makeUser('notif-5@test.com');
    const uid = user._id;
    const created = await notifyMany([
      { user: uid, type: 'general', title: 'א', dedupeKey: 'm:1' },
      { user: uid, type: 'general', title: 'ב', dedupeKey: 'm:1' }, // כפול → לא נספר
      { user: uid, type: 'general', title: 'ג', dedupeKey: 'm:2' },
    ]);
    expect(created).toBe(2);
  });
});

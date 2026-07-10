import Alert from '../models/Alert.js';
import User from '../models/User.js';
import { sendEmail } from './emailService.js';
import logger from '../utils/logger.js';

/**
 * notificationService — the single entry point for raising a notification.
 *
 * The in-app `Alert` collection *is* the notification store (there is no
 * separate `Notification` model — that would duplicate it). This service adds
 * the two things the spec's notification engine needs on top of a raw insert:
 *   1. centralized de-duplication (a stable dedupeKey + time window), so the
 *      same alert isn't raised twice by overlapping generators/schedulers;
 *   2. multi-channel delivery — always in-app, optionally email — recording
 *      what was actually delivered (emailSentAt only set on real delivery).
 *
 * Used by: alert generation, the budget cycle, and the import runner
 * (bank-sync-failed). Server-side only.
 */

const DEFAULT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Raise one notification for a single user.
 * @param {object} p
 * @param {string|object} p.user            user ObjectId (required)
 * @param {string} p.type                   Alert.type enum value
 * @param {string} p.title
 * @param {string} p.message
 * @param {string} [p.icon]
 * @param {'info'|'warning'|'danger'|'success'} [p.severity]
 * @param {string} [p.actionUrl]
 * @param {string} [p.actionLabel]
 * @param {string} [p.relatedModel]
 * @param {object} [p.relatedId]
 * @param {Date}   [p.expiresAt]
 * @param {string[]} [p.channels]           ['inapp'] | ['inapp','email']
 * @param {string} [p.dedupeKey]            stable key; if a live alert with this
 *                                          key exists within the window, skip
 * @param {number} [p.dedupeWindowMs]
 * @returns {Promise<{created:boolean, alert?:object, reason?:string}>}
 */
export const notify = async (p) => {
  if (!p?.user || !p?.type || !p?.title) {
    throw new Error('notify requires { user, type, title }');
  }

  const channels = p.channels?.length ? p.channels : ['inapp'];
  const dedupeKey = p.dedupeKey || `${p.type}:${p.relatedId || p.title}`;

  // ── De-dup: is there already a live alert with this key in the window? ──
  const since = new Date(Date.now() - (p.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS));
  const existing = await Alert.findOne({
    user: p.user,
    dedupeKey,
    isDismissed: false,
    createdAt: { $gte: since },
  }).lean();
  if (existing) return { created: false, reason: 'deduped', alert: existing };

  const alert = await Alert.create({
    user: p.user,
    type: p.type,
    title: p.title,
    message: p.message || p.title, // Alert.message is required — fall back to title
    icon: p.icon,
    severity: p.severity || 'info',
    actionUrl: p.actionUrl,
    actionLabel: p.actionLabel,
    relatedModel: p.relatedModel,
    relatedId: p.relatedId,
    expiresAt: p.expiresAt,
    channels,
    dedupeKey,
  });

  // ── Email channel (best-effort; never blocks or fails the caller) ──
  if (channels.includes('email')) {
    try {
      const owner = await User.findById(p.user).select('email name').lean();
      const { delivered } = await sendEmail({
        to: owner?.email,
        subject: p.title,
        text: p.message || p.title,
      });
      if (delivered) {
        alert.emailSentAt = new Date();
        await alert.save();
      }
    } catch (err) {
      logger.error(`[notify] email channel failed: ${err.message}`);
    }
  }

  return { created: true, alert };
};

/**
 * Convenience for many notifications at once (e.g. per household member).
 * De-dup still applies per-user. Returns how many were actually created.
 */
export const notifyMany = async (items = []) => {
  let created = 0;
  for (const item of items) {
    try {
      const res = await notify(item);
      if (res.created) created += 1;
    } catch (err) {
      logger.error(`[notify] item failed: ${err.message}`);
    }
  }
  return created;
};

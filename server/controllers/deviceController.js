import crypto from 'crypto';
import Device from '../models/Device.js';
import ImportJob from '../models/ImportJob.js';
import AppError from '../utils/AppError.js';
import { audit } from '../utils/audit.js';
import { hashDeviceToken } from '../middlewares/deviceAuth.js';
import { submitJobOtp } from '../services/importRunner.js';
import { notify } from '../services/notificationService.js';
import { COMPANY_CONFIG } from '../services/scrapeService.js';

/**
 * deviceController — pairing a phone that relays bank SMS codes (CAL) and the
 * phone-side endpoints. Contract for the Android app: docs/modules/import.md
 * § "Phone OTP relay".
 */

const MAX_DEVICES = 5;
const DEVICE_OTP_COMPANIES = Object.entries(COMPANY_CONFIG)
  .filter(([, cfg]) => cfg.deviceOtp)
  .map(([key]) => key);

// ── Session side (web) ─────────────────────────────────────────────────────

/** GET /api/devices — the user's paired phones (active first). */
export const listDevices = async (req, res, next) => {
  try {
    const devices = await Device.find({ user: req.user._id, revokedAt: null }).sort({ createdAt: -1 }).lean();
    res.json(devices);
  } catch (err) { next(err); }
};

/** POST /api/devices { name } — pair a new phone. The raw token is returned ONCE. */
export const pairDevice = async (req, res, next) => {
  try {
    const count = await Device.countDocuments({ user: req.user._id, revokedAt: null });
    if (count >= MAX_DEVICES) throw new AppError(`אפשר לצמד עד ${MAX_DEVICES} מכשירים — בטל מכשיר ישן קודם`, 400);

    const token = `fd_${crypto.randomBytes(32).toString('base64url')}`;
    const device = await Device.create({
      user: req.user._id,
      name: String(req.body?.name || 'טלפון').trim().slice(0, 60) || 'טלפון',
      tokenHash: hashDeviceToken(token),
      tokenHint: token.slice(0, 7),
    });

    await audit(req, 'device.pair', 'Device', { entityId: device._id, after: { name: device.name } });
    // Visible trace of every pairing, so an unexpected one can be revoked.
    await notify({
      user: req.user._id,
      type: 'general',
      title: 'טלפון חדש צומד לחשבון',
      message: `"${device.name}" יכול עכשיו להעביר קודי SMS לסנכרון. לא אתה? בטל את הצימוד בעמוד החיבורים.`,
      severity: 'info',
      actionUrl: '/connections',
      actionLabel: 'לחיבורים',
      relatedModel: 'Device',
      relatedId: device._id,
      dedupeKey: `device_pair:${device._id}`,
    }).catch(() => {});
    res.status(201).json({ device, token });
  } catch (err) { next(err); }
};

/** DELETE /api/devices/:id — revoke a phone (its token stops working at once). */
export const revokeDevice = async (req, res, next) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
      { new: true },
    );
    if (!device) throw new AppError('המכשיר לא נמצא', 404);
    await audit(req, 'device.revoke', 'Device', { entityId: device._id, before: { name: device.name } });
    res.json({ message: 'הצימוד בוטל' });
  } catch (err) { next(err); }
};

// ── Device side (phone app, `Authorization: Device <token>`) ──────────────

/** POST /api/devices/heartbeat — the app is alive; reports whether a code is awaited. */
export const heartbeat = async (req, res, next) => {
  try {
    req.device.lastSeenAt = new Date();
    await req.device.save();
    const waiting = await ImportJob.exists({
      user: req.user._id,
      company: { $in: DEVICE_OTP_COMPANIES },
      status: 'awaiting_otp',
      otpExpiresAt: { $gt: new Date() },
    });
    res.json({ ok: true, awaitingOtp: !!waiting });
  } catch (err) { next(err); }
};

// The SMS must look like it comes from CAL before it may be tried as a code —
// every attempt counts at CAL, and the Relay app forwards *all* incoming SMS.
const CAL_SMS = /cal|כאל|ויזה/i;
export const looksLikeCalSms = (from, body) => CAL_SMS.test(String(from || '')) || CAL_SMS.test(String(body || ''));

/**
 * POST /api/devices/sms — webhook for the Relay SMS app (AppSms repo), in its own
 * contract: `Authorization: Bearer <device token>`, body `{ id, from, body,
 * receivedAt, platform }`. Mounted before the CSRF middleware (token auth, no
 * cookies). The SMS text is never stored or logged. Always answers 2xx for a
 * handled message (Relay retries 408/429/5xx), 401 for a bad token.
 */
export const relaySmsInbound = async (req, res, next) => {
  try {
    req.device.lastSeenAt = new Date();
    await req.device.save();

    const { from, body } = req.body || {};
    const job = await ImportJob.findOne({
      user: req.user._id,
      company: { $in: DEVICE_OTP_COMPANIES },
      status: 'awaiting_otp',
      otpExpiresAt: { $gt: new Date() },
    }).sort({ otpRequestedAt: -1 }).lean();

    if (!job) return res.json({ handled: false, reason: 'no-sync-waiting' });
    if (!body || !looksLikeCalSms(from, body)) return res.json({ handled: false, reason: 'not-a-cal-sms' });

    try {
      const finished = await submitJobOtp(job._id, body);
      req.device.lastOtpAt = new Date();
      await req.device.save();
      await audit(req, 'device.otp', 'ImportJob', { entityId: job._id, after: { device: req.device._id, via: 'relay' } });
      return res.json({ handled: true, status: finished.status, inserted: finished.stats?.inserted ?? 0 });
    } catch (err) {
      // Wrong / expired code etc. — reported, but not as a retryable failure.
      if (err.statusCode && err.statusCode < 500) return res.json({ handled: false, reason: err.message });
      throw err;
    }
  } catch (err) { next(err); }
};

/**
 * POST /api/devices/otp { code } | { message, sender }
 * The phone relays the bank SMS (or just the code). Applied to the owner's most
 * recent sync that is waiting for a code. 404 when nothing is waiting (the app
 * may simply ignore it).
 */
export const submitDeviceOtp = async (req, res, next) => {
  try {
    const input = req.body?.code ?? req.body?.message;
    if (!input) throw new AppError('חסר קוד או תוכן הודעה', 400);
    if (!req.body?.code && !looksLikeCalSms(req.body?.sender, req.body?.message)) {
      return res.status(404).json({ matched: false, message: 'ההודעה אינה מכאל' });
    }

    const job = await ImportJob.findOne({
      user: req.user._id,
      company: { $in: DEVICE_OTP_COMPANIES },
      status: 'awaiting_otp',
      otpExpiresAt: { $gt: new Date() },
    }).sort({ otpRequestedAt: -1 }).lean();
    if (!job) return res.status(404).json({ matched: false, message: 'אין סנכרון שממתין לקוד' });

    req.device.lastSeenAt = new Date();
    req.device.lastOtpAt = new Date();
    await req.device.save();

    const finished = await submitJobOtp(job._id, input);
    await audit(req, 'device.otp', 'ImportJob', { entityId: job._id, after: { device: req.device._id } });
    res.json({ matched: true, status: finished.status, stats: finished.stats });
  } catch (err) { next(err); }
};

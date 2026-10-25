import crypto from 'crypto';
import Device from '../models/Device.js';
import ImportJob from '../models/ImportJob.js';
import AppError from '../utils/AppError.js';
import { audit } from '../utils/audit.js';
import { hashDeviceToken } from '../middlewares/deviceAuth.js';
import { submitJobOtp, extractOtp } from '../services/importRunner.js';
import logger from '../utils/logger.js';
import { qrDataUrl } from '../services/twoFactorService.js';
import { notify } from '../services/notificationService.js';
import { deviceCalStep, deviceTaskPending } from '../services/calDeviceSync.js';
import { COMPANY_CONFIG } from '../services/scrapeService.js';

/**
 * deviceController — pairing a phone that relays bank SMS codes (CAL) and the
 * phone-side endpoints. Contract for the Android app: docs/modules/import.md
 * § "Phone OTP relay".
 */

const MAX_DEVICES = 5;
// How long after a sync begins its SMS may legitimately arrive before the job is
// saved as 'waiting for code' (the CAL request itself takes a few seconds).
const SYNC_STARTING_WINDOW_MS = 2 * 60 * 1000;
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
    // QR for the phone app: scanning avoids hand-copying a 46-character key (a single
    // wrong character = "unknown device"). Format: finasms://pair?token=fd_…
    const qr = await qrDataUrl(`finasms://pair?token=${token}`);
    res.status(201).json({ device, token, qr });
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

/**
 * POST /api/devices/heartbeat — the app is alive; reports whether a code is awaited
 * and whether a phone-run CAL sync is waiting to be picked up (`calTask`).
 */
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
    const calTask = await deviceTaskPending(req.user._id);
    res.json({ ok: true, awaitingOtp: !!waiting, calTask, deviceName: req.device.name, serverTime: new Date().toISOString() });
  } catch (err) { next(err); }
};

/**
 * POST /api/devices/cal/step — the phone runs the CAL session for calAuto (CAL rejects
 * the server's IP). `{}` asks for work; later calls answer the previous action. See
 * services/calDeviceSync.js for the protocol. Mounted before CSRF (Bearer device token).
 */
export const calStep = async (req, res, next) => {
  try {
    req.device.lastSeenAt = new Date();
    await req.device.save();
    const result = await deviceCalStep(req.device, req.body || {});
    if (result.action !== 'none' && !req.body?.jobId) {
      await audit(req, 'device.calSync', 'ImportJob', { entityId: result.jobId, after: { device: req.device._id } });
    }
    res.json(result);
  } catch (err) { next(err); }
};

// The SMS must look like it comes from CAL before it may be tried as a code —
// every attempt counts at CAL, and the Relay app forwards *all* incoming SMS.
// (Hebrew words are matched whole: "כאלה" = "such" must not count.) Keep in sync with
// SmsFilter.kt in the AppSms repo — same pattern on both sides.
// Real CAL OTP sender (seen 2026-10): "CalLogin"; bodies say "... של כאל" / cal-online.co.il.
export const CAL_SMS = /cal\s*login|visa\s*cal|\bcal\b|cal-?online|(?<![\u05D0-\u05EA])[\u05D1\u05DC\u05DE\u05D4\u05D5\u05E9\u05DB]?(\u05DB\u05D0\u05DC|\u05D5\u05D9\u05D6\u05D4)(?![\u05D0-\u05EA])/i;
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
      runsOn: { $ne: 'device' }, // phone-run syncs use the code on the phone itself
      otpExpiresAt: { $gt: new Date() },
    }).sort({ otpRequestedAt: -1 }).lean();

    if (!body || !looksLikeCalSms(from, body)) return res.json({ handled: false, reason: 'not-a-cal-sms' });
    if (!extractOtp(body)) return res.json({ handled: false, reason: 'no-code' });

    if (!job) {
      // The SMS can beat the server: CAL has sent it, but the sync has not yet saved
      // its 'waiting for code' state. Tell the phone to retry shortly instead of
      // dropping the one-time code.
      const starting = await ImportJob.exists({
        user: req.user._id,
        company: { $in: DEVICE_OTP_COMPANIES },
        status: { $in: ['queued', 'running'] },
        otpRequestedAt: null,
        // measured from when the job actually started (a job may sit queued first)
        $or: [
          { startedAt: { $gt: new Date(Date.now() - SYNC_STARTING_WINDOW_MS) } },
          { startedAt: null, createdAt: { $gt: new Date(Date.now() - SYNC_STARTING_WINDOW_MS) } },
        ],
      });
      if (starting) return res.status(425).json({ handled: false, reason: 'sync-starting', retry: true });
      return res.json({ handled: false, reason: 'no-sync-waiting' });
    }

    // Acknowledge at once: finishing the sync (CAL login + fetching transactions) can
    // take longer than the phone's HTTP timeout, and a timed-out request would be
    // retried for nothing. The result shows in Fina (and in an alert on failure).
    req.device.lastOtpAt = new Date();
    await req.device.save();
    submitJobOtp(job._id, body)
      .then(() => audit(req, 'device.otp', 'ImportJob', { entityId: job._id, after: { device: req.device._id, via: 'relay' } }))
      .catch((err) => logger.warn('[devices/sms] code not accepted: ' + err.message));
    return res.json({ handled: true, accepted: true });
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
      runsOn: { $ne: 'device' },
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

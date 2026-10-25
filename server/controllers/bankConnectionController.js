import BankConnection from '../models/BankConnection.js';
import ImportJob from '../models/ImportJob.js';
import AppError from '../utils/AppError.js';
import { audit } from '../utils/audit.js';
import { scopeFilter } from '../utils/scopeFilter.js';
import { encrypt } from '../utils/crypto.js';
import { getCompanyConfig, buildCredentials, getCompaniesConfig } from '../services/scrapeService.js';
import { enqueueImportJob, runImportJob, submitJobOtp } from '../services/importRunner.js';
import { computeNextSyncAt } from '../services/importScheduler.js';

const IN_FLIGHT_WINDOW_MS = 30 * 60 * 1000;

/**
 * bankConnectionController — CRUD + sync for saved bank connections
 * (Phase 2, Import 2.0). Credentials are encrypted on write and NEVER returned;
 * the model's select:false + toJSON transform guarantee metadata-only responses.
 * See docs/modules/import.md and docs/api-reference.md.
 */

const WRITABLE_META = ['displayName', 'autoSync', 'incomesOnly'];

// Israel-local hour 0-23; undefined when not supplied, 400 when invalid.
const parseSyncHour = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const hour = Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new AppError('שעת סנכרון לא תקינה (0-23)', 400);
  return hour;
};

/** Which credential fields a company needs (throws 400 for unknown company). */
export const listCompanies = (req, res) => {
  res.json(getCompaniesConfig());
};

/** GET /api/connections — all connections in the caller's household (metadata only). */
export const listConnections = async (req, res, next) => {
  try {
    const connections = await BankConnection.find(scopeFilter(req))
      .sort({ createdAt: -1 })
      .lean(); // select:false keeps credentials/otpLongTermToken out of lean results

    // Surface any sync currently waiting for an SMS code (scheduled or manual),
    // so the UI can show "waiting for code" + a manual entry fallback.
    const waiting = await ImportJob.find({
      connection: { $in: connections.map((c) => c._id) },
      status: 'awaiting_otp',
      otpExpiresAt: { $gt: new Date() },
    }).select('_id connection otpExpiresAt maskedPhone runsOn deviceStage').lean();
    const byConn = new Map(waiting.map((j) => [String(j.connection), j]));

    res.json(connections.map((c) => ({ ...c, pendingOtpJob: byConn.get(String(c._id)) || null })));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/connections — create an encrypted connection.
 * Body: { company, displayName?, autoSync?, incomesOnly?, otpLongTermToken?, ...credFields }
 */
export const createConnection = async (req, res, next) => {
  try {
    const { company, displayName, autoSync, incomesOnly, otpLongTermToken, syncHour: rawHour, ...formFields } = req.body;
    const config = getCompanyConfig(company); // throws 400 if unknown
    const syncHour = parseSyncHour(rawHour) ?? 6;

    let credentials;
    let encryptedToken;

    if (config.otpFlow) {
      // One Zero: token-based auto-sync. Need email + password + a long-term token
      // obtained via the /api/scrape/onezero/otp/* flow.
      const { email, password, phoneNumber } = formFields;
      if (!email || !password) throw new AppError('חסרים אימייל או סיסמה ל-One Zero', 400);
      if (!otpLongTermToken) throw new AppError('חסר טוקן OTP ל-One Zero — השלם קודם את אימות ה-SMS', 400);
      credentials = { email, password, ...(phoneNumber ? { phoneNumber } : {}) };
      encryptedToken = encrypt(otpLongTermToken);
    } else {
      credentials = buildCredentials(config, formFields); // validates required fields
    }

    const connection = await BankConnection.create({
      user: req.user._id,
      household: req.householdId || undefined,
      company,
      displayName: displayName || config.name,
      credentials: encrypt(JSON.stringify(credentials)),
      otpLongTermToken: encryptedToken,
      autoSync: autoSync !== false,
      incomesOnly: !!incomesOnly,
      status: 'active',
      syncHour,
      nextSyncAt: computeNextSyncAt(new Date(), syncHour),
    });

    await audit(req, 'bankConnection.create', 'BankConnection', {
      entityId: connection._id,
      after: { company, displayName: connection.displayName },
    });

    res.status(201).json(connection); // toJSON strips secrets
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/connections/:id — update metadata and/or re-auth credentials. */
export const updateConnection = async (req, res, next) => {
  try {
    const connection = await BankConnection.findOne({ _id: req.params.id, ...scopeFilter(req) })
      .select('+credentials');
    if (!connection) return next(new AppError('החיבור לא נמצא', 404));

    for (const field of WRITABLE_META) {
      if (req.body[field] !== undefined) connection[field] = req.body[field];
    }

    const syncHour = parseSyncHour(req.body.syncHour);
    if (syncHour !== undefined && syncHour !== connection.syncHour) {
      connection.syncHour = syncHour;
      connection.nextSyncAt = computeNextSyncAt(new Date(), syncHour);
    }

    // Optional credential rotation — re-encrypt only if new fields were supplied.
    const config = getCompanyConfig(connection.company);
    const credFieldsProvided = config.credFields.some((f) => req.body[f] !== undefined);
    if (credFieldsProvided && !config.otpFlow) {
      connection.credentials = encrypt(JSON.stringify(buildCredentials(config, req.body)));
      connection.status = 'active';
      connection.lastError = undefined;
      connection.consecutiveFailures = 0;
    }
    if (req.body.otpLongTermToken) {
      connection.otpLongTermToken = encrypt(req.body.otpLongTermToken);
      connection.status = 'active';
      connection.lastError = undefined;
    }

    // Explicit enable/disable of auto-sync toggles status between active/disabled.
    if (req.body.autoSync === false && connection.status === 'active') connection.status = 'disabled';
    if (req.body.autoSync === true && connection.status === 'disabled') connection.status = 'active';
    // Re-enabling must not fire an immediate sync from a stale slot (for CAL: a surprise SMS).
    if (req.body.autoSync === true && (!connection.nextSyncAt || connection.nextSyncAt < new Date())) {
      connection.nextSyncAt = computeNextSyncAt(new Date(), connection.syncHour ?? 6);
    }

    await connection.save();
    await audit(req, 'bankConnection.update', 'BankConnection', { entityId: connection._id });
    res.json(connection);
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/connections/:id — soft delete. */
export const deleteConnection = async (req, res, next) => {
  try {
    const connection = await BankConnection.softDeleteOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!connection) return next(new AppError('החיבור לא נמצא', 404));

    // Disconnecting must remove the stored bank secrets, not just hide the row.
    // (credentials is `required` on the schema, so unset at the driver level.)
    await BankConnection.collection.updateOne(
      { _id: connection._id },
      { $unset: { credentials: '', otpLongTermToken: '' }, $set: { autoSync: false, status: 'disabled' } },
    );

    await audit(req, 'bankConnection.delete', 'BankConnection', {
      entityId: connection._id,
      before: { company: connection.company, displayName: connection.displayName },
    });
    res.json({ message: 'החיבור נמחק' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/connections/:id/sync — trigger an immediate sync.
 * Enqueues a background ImportJob and returns its id for polling.
 */
export const syncConnection = async (req, res, next) => {
  try {
    const connection = await BankConnection.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!connection) return next(new AppError('החיבור לא נמצא', 404));

    // Single-flight: a second click must not start a parallel bank login (or a
    // second CAL SMS). Hand back the in-flight job instead.
    const inFlight = await ImportJob.findOne({
      connection: connection._id,
      createdAt: { $gte: new Date(Date.now() - IN_FLIGHT_WINDOW_MS) },
      $or: [
        { status: { $in: ['queued', 'running'] } },
        { status: 'awaiting_otp', otpExpiresAt: { $gt: new Date() } }, // an expired wait no longer blocks
      ],
    }).sort({ createdAt: -1 }).lean();
    if (inFlight) {
      return res.status(409).json({ message: 'סנכרון כבר פועל עבור החיבור הזה', jobId: inFlight._id, status: inFlight.status });
    }

    const job = await enqueueImportJob(connection, { trigger: 'manual' });
    await audit(req, 'bankConnection.sync', 'BankConnection', { entityId: connection._id });
    res.status(202).json({ jobId: job._id, status: job.status });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/connections/jobs/:id/otp { code } — finish a sync that is waiting
 * for an SMS code, typed on the web (fallback when the phone app isn't paired).
 */
export const submitOtp = async (req, res, next) => {
  try {
    const job = await ImportJob.findOne({ _id: req.params.id, ...scopeFilter(req) }).lean();
    if (!job) return next(new AppError('משימת הייבוא לא נמצאה', 404));
    if (job.runsOn === 'device') return next(new AppError('הסנכרון הזה רץ דרך הטלפון — הקוד יטופל שם אוטומטית', 409));

    const finished = await submitJobOtp(job._id, req.body?.code);
    await audit(req, 'bankConnection.otp', 'BankConnection', { entityId: job.connection });
    res.json(finished);
  } catch (err) {
    next(err);
  }
};

/** GET /api/connections/:id/jobs — recent sync history for a connection. */
export const listConnectionJobs = async (req, res, next) => {
  try {
    // Ownership check via the connection, then jobs scoped to the same user set.
    const connection = await BankConnection.findOne({ _id: req.params.id, ...scopeFilter(req) }).lean();
    if (!connection) return next(new AppError('החיבור לא נמצא', 404));

    const jobs = await ImportJob.find({ connection: connection._id, ...scopeFilter(req) })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json(jobs);
  } catch (err) {
    next(err);
  }
};

/** GET /api/connections/jobs/:id — poll a single job's status. */
export const getJob = async (req, res, next) => {
  try {
    const job = await ImportJob.findOne({ _id: req.params.id, ...scopeFilter(req) }).lean();
    if (!job) return next(new AppError('משימת הייבוא לא נמצאה', 404));
    res.json(job);
  } catch (err) {
    next(err);
  }
};

// Exported for tests — run a job synchronously instead of fire-and-forget.
export const __runImportJob = runImportJob;

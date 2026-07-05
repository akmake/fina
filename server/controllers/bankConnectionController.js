import BankConnection from '../models/BankConnection.js';
import ImportJob from '../models/ImportJob.js';
import AppError from '../utils/AppError.js';
import { audit } from '../utils/audit.js';
import { scopeFilter } from '../utils/scopeFilter.js';
import { encrypt } from '../utils/crypto.js';
import { getCompanyConfig, buildCredentials, getCompaniesConfig } from '../services/scrapeService.js';
import { enqueueImportJob, runImportJob } from '../services/importRunner.js';
import { computeNextSyncAt } from '../services/importScheduler.js';

/**
 * bankConnectionController — CRUD + sync for saved bank connections
 * (Phase 2, Import 2.0). Credentials are encrypted on write and NEVER returned;
 * the model's select:false + toJSON transform guarantee metadata-only responses.
 * See docs/modules/import.md and docs/api-reference.md.
 */

const WRITABLE_META = ['displayName', 'autoSync', 'incomesOnly'];

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
    res.json(connections);
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
    const { company, displayName, autoSync, incomesOnly, otpLongTermToken, ...formFields } = req.body;
    const config = getCompanyConfig(company); // throws 400 if unknown

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
      nextSyncAt: computeNextSyncAt(),
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

    // Optional credential rotation — re-encrypt only if new fields were supplied.
    const config = getCompanyConfig(connection.company);
    const credFieldsProvided = config.credFields.some((f) => req.body[f] !== undefined);
    if (credFieldsProvided && !config.otpFlow) {
      connection.credentials = encrypt(JSON.stringify(buildCredentials(config, req.body)));
      connection.status = 'active';
      connection.lastError = undefined;
    }
    if (req.body.otpLongTermToken) {
      connection.otpLongTermToken = encrypt(req.body.otpLongTermToken);
      connection.status = 'active';
      connection.lastError = undefined;
    }

    // Explicit enable/disable of auto-sync toggles status between active/disabled.
    if (req.body.autoSync === false && connection.status === 'active') connection.status = 'disabled';
    if (req.body.autoSync === true && connection.status === 'disabled') connection.status = 'active';

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

    const job = await enqueueImportJob(connection, { trigger: 'manual' });
    await audit(req, 'bankConnection.sync', 'BankConnection', { entityId: connection._id });
    res.status(202).json({ jobId: job._id, status: job.status });
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

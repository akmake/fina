import AuditLog from '../models/AuditLog.js';
import logger from './logger.js';

/**
 * תיעוד פעולה רגישה. לעולם לא מפיל את הפעולה העסקית —
 * כשל בתיעוד נרשם ללוג הרגיל בלבד.
 *
 * @param {object} req      בקשת Express (לזיהוי actor + IP)
 * @param {string} action   'transaction.delete' / 'user.role.change' וכו'
 * @param {string} entity   שם המודל
 * @param {object} [opts]   { entityId, before, after }
 */
export async function audit(req, action, entity, opts = {}) {
  try {
    await AuditLog.create({
      actor: req.user?._id,
      action,
      entity,
      entityId: opts.entityId,
      before: opts.before,
      after: opts.after,
      ip: req.ip,
    });
  } catch (err) {
    logger.error(`Audit write failed for ${action}: ${err.message}`);
  }
}

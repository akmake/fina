import ApiKey from '../models/ApiKey.js';
import User from '../models/User.js';
import { hashDeviceToken } from './deviceAuth.js';

const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Authenticates the read-only AI key: `Authorization: Bearer fk_<…>`.
 * GET only — any other method is refused, so a leaked key can never change data.
 * Sets a minimal req.user (owner id) for resolveHousehold/scopeFilter.
 */
export default async function apiKeyAuth(req, res, next) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'מפתח AI הוא לקריאה בלבד' });
    }
    const [scheme, token] = (req.get('authorization') || '').split(' ');
    if (scheme !== 'Bearer' || !token?.startsWith('fk_')) {
      return res.status(401).json({ message: 'נדרש מפתח AI' });
    }

    const key = await ApiKey.findOne({ tokenHash: hashDeviceToken(token), revokedAt: null });
    if (!key) return res.status(401).json({ message: 'מפתח AI לא תקין או שבוטל' });

    const owner = await User.findById(key.user).select('_id deletedAt approvalStatus').lean();
    if (!owner || owner.deletedAt || ['pending', 'rejected'].includes(owner.approvalStatus)) {
      return res.status(401).json({ message: 'החשבון אינו פעיל' });
    }

    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
      key.lastUsedAt = new Date();
      await key.save();
    }

    req.apiKey = key;
    req.user = { _id: owner._id, id: owner._id };
    next();
  } catch (err) {
    next(err);
  }
}

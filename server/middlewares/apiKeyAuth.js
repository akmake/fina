import ApiKey from '../models/ApiKey.js';
import User from '../models/User.js';
import { hashDeviceToken } from './deviceAuth.js';

const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Authenticates the AI key: `Authorization: Bearer fk_<…>`.
 * GET is always allowed; any write needs a scope (see requireAiScope) — a plain
 * key can never change data. Sets a minimal req.user (owner id) for scoping.
 */
export const requireAiScope = (scope) => (req, res, next) => {
  if (!req.apiKey?.scopes?.includes(scope)) {
    return res.status(403).json({ message: 'למפתח הזה אין הרשאה לשנות שמות וקטגוריות — צור מפתח עם ההרשאה בהגדרות' });
  }
  next();
};

export default async function apiKeyAuth(req, res, next) {
  try {
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

    // Writes only with an explicit scope; checked again per route by requireAiScope.
    // (The remote MCP endpoint always POSTs JSON-RPC; its write tools check the scope themselves.)
    if (req.method !== 'GET' && !req.isMcp && !(key.scopes || []).length) {
      return res.status(405).json({ message: 'מפתח AI הוא לקריאה בלבד' });
    }

    req.apiKey = key;
    req.user = { _id: owner._id, id: owner._id };
    next();
  } catch (err) {
    next(err);
  }
}

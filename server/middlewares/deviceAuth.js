import crypto from 'crypto';
import Device from '../models/Device.js';
import User from '../models/User.js';

export const hashDeviceToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * Authenticates a paired phone by `Authorization: Device <token>` — or
 * `Bearer <token>`, which is what the Relay SMS app (AppSms repo) sends.
 * Sets req.device and a minimal req.user (owner id) — NOT a session: only the
 * device routes accept it. Rejects revoked devices and inactive owners.
 */
export default async function deviceAuth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (!['Device', 'Bearer'].includes(scheme) || !token?.startsWith('fd_')) {
      return res.status(401).json({ message: 'מכשיר לא מזוהה' });
    }

    const device = await Device.findOne({ tokenHash: hashDeviceToken(token), revokedAt: null });
    if (!device) return res.status(401).json({ message: 'מכשיר לא מזוהה או שהצימוד בוטל' });

    const owner = await User.findById(device.user).select('_id deletedAt approvalStatus').lean();
    if (!owner || owner.deletedAt || ['pending', 'rejected'].includes(owner.approvalStatus)) {
      return res.status(401).json({ message: 'החשבון אינו פעיל' });
    }

    req.device = device;
    req.user = { _id: owner._id, id: owner._id };
    next();
  } catch (err) {
    next(err);
  }
}

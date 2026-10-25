import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Is a session still valid for this user? Rejects deleted / pending / rejected
 * accounts and tokens issued before the last tokenVersion bump (block, password
 * change). Tokens issued before the `tv` claim existed skip the version check
 * (they expire within 15 min).
 */
export const sessionUserIsActive = (user, decoded) => {
  if (!user || user.deletedAt) return false;
  if (['pending', 'rejected'].includes(user.approvalStatus)) return false;
  if (decoded.tv !== undefined && decoded.tv !== (user.tokenVersion || 0)) return false;
  return true;
};

export const requireAuth = async (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({ message: 'לא מחובר' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'טוקן לא חוקי / פג תוקף' });
  }

  // A 2FA mfaToken (mfa claim) is only exchangeable at /api/auth/2fa/login — never a session.
  if (decoded.mfa) {
    return res.status(401).json({ message: 'טוקן לא חוקי / פג תוקף' });
  }

  try {
    const user = await User.findById(decoded.id).select('deletedAt approvalStatus tokenVersion').lean();
    if (!sessionUserIsActive(user, decoded)) {
      return res.status(401).json({ message: 'החיבור הסתיים — יש להתחבר מחדש' });
    }
  } catch (err) {
    return next(err);
  }

  // התיקון הקריטי: אנחנו שמים גם 'id' וגם '_id' כדי למנוע התנגשויות
  req.user = {
      id: decoded.id,
      _id: decoded.id, // זה השדה שהקונטרולרים מחפשים!
      role: decoded.role
  };

  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'הרשאת מנהל נדרשת' });
  }
  next();
};

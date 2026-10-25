import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sessionUserIsActive } from './authMiddleware.js';

export default async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.jwt;
    if (!token) {
      return res.status(401).json({ message: 'לא מחובר' });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    // A 2FA mfaToken (mfa claim) is only exchangeable at /api/auth/2fa/login — never a session.
    if (decoded.mfa) {
      return res.status(401).json({ message: 'טוקן לא חוקי או פג תוקף' });
    }

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!sessionUserIsActive(user, decoded)) {
      return res.status(401).json({ message: 'החיבור הסתיים — יש להתחבר מחדש' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'טוקן לא חוקי או פג תוקף' });
  }
}
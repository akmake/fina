import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

export default async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.jwt;
    if (!token) {
      return res.status(401).json({ message: 'לא מחובר' });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'משתמש לא נמצא' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'טוקן לא חוקי או פג תוקף' });
  }
}
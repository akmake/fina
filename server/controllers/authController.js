import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { createAndSendTokens } from '../utils/tokenHandler.js';

export const registerUser = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;
    
    if (!name || !email || !password)
      return res.status(400).json({ message: 'שם, אימייל וסיסמה הם שדות חובה' });
    
    email = email.toLowerCase().trim();

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים' });

    // הוסרה הבדיקה הידנית לסיסמה מורכבת (Regex).
    // כעת ההגבלה היחידה היא אורך מינימלי של 8 תווים (אם מוגדר בוולידטור).

    const hash = await bcrypt.hash(password, 12);
    const finalRole = role === 'admin' ? 'admin' : 'user';
    
    const user = await User.create({ name, email, passwordHash: hash, role: finalRole });
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
    
    createAndSendTokens(user, res);
    return res.status(201).json({ message: "ההרשמה הושלמה בהצלחה", user: userPayload });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ message: "שגיאה פנימית בשרת בעת ההרשמה", error: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;
    
    if (!email || !password)
      return res.status(400).json({ message: 'חסר אימייל או סיסמה' });
    
    email = email.toLowerCase().trim();

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: 'משתמש לא קיים' });
    
    if (user.isLocked)
      return res.status(423).json({ message: 'החשבון נעול זמנית' });
    
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      // מניח שפונקציות אלו קיימות במודל המשתמש שלך
      if (typeof user.incrementLoginAttempts === 'function') {
          await user.incrementLoginAttempts();
      }
      return res.status(401).json({ message: 'סיסמה שגויה' });
    }
    
    if (typeof user.resetLoginAttempts === 'function') {
        await user.resetLoginAttempts();
    }
    
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
    createAndSendTokens(user, res);
    return res.status(200).json({ message: "התחברת בהצלחה", user: userPayload });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "שגיאה פנימית בשרת בעת ההתחברות", error: error.message });
  }
};

export const logout = async (req, res) => {
    const secure = process.env.NODE_ENV === 'production';
    const sameSite = process.env.NODE_ENV === 'production' ? 'none' : 'lax';
    
    res.clearCookie('jwt', { httpOnly: true, sameSite, secure });
    res.clearCookie('refreshToken', { httpOnly: true, sameSite, secure });
    return res.sendStatus(204);
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided.' });
  }
  
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user || user.tokenVersion !== decoded.v) {
      return res.status(403).json({ message: 'Forbidden. Please log in again.' });
    }
    
    createAndSendTokens(user, res);
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
    return res.status(200).json({ message: "Tokens refreshed successfully", user: userPayload });
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired refresh token.' });
  }
};
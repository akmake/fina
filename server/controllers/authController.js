import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const createAndSendTokens = (user, res) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { id: user._id, version: user.tokenVersion },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('jwt', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
};

const oauth2Client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /auth/google — receives either ID token (credential) or access_token
export const googleAuth = async (req, res) => {
  try {
    const { credential, access_token } = req.body;
    if (!credential && !access_token) {
      return res.status(400).json({ message: 'חסר טוקן גוגל' });
    }

    let googleId, email, name, avatar;

    if (credential) {
      // ID token path (GoogleLogin component)
      const ticket = await oauth2Client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      ({ sub: googleId, email, name, picture: avatar } = ticket.getPayload());
    } else {
      // Access token path (useGoogleLogin hook)
      const resp = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`);
      if (!resp.ok) return res.status(401).json({ message: 'טוקן גוגל לא תקין' });
      ({ sub: googleId, email, name, picture: avatar } = await resp.json());
    }

    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        // משתמש קיים עם אותה כתובת — מקשרים את חשבון הגוגל
        user.googleId = googleId;
        user.avatar = user.avatar || avatar;
        await user.save();
      } else {
        // משתמש חדש לחלוטין
        user = await User.create({ googleId, email, name, avatar });
      }
    }

    createAndSendTokens(user, res);

    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
    return res.status(200).json({ message: 'התחברת בהצלחה עם גוגל', user: userPayload });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(401).json({ message: 'ההתחברות עם גוגל נכשלה', error: error.message });
  }
};

export const registerUser = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'שם, אימייל וסיסמה הם שדות חובה' });

    email = email.toLowerCase().trim();

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים' });

    const hash = await bcrypt.hash(password, 12);
    const finalRole = role === 'admin' ? 'admin' : 'user';

    const user = await User.create({ name, email, passwordHash: hash, role: finalRole });

    createAndSendTokens(user, res);
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
    return res.status(201).json({ message: 'ההרשמה הושלמה בהצלחה', user: userPayload });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'שגיאה פנימית בשרת בעת ההרשמה', error: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'חסר אימייל או סיסמה' });

    email = email.toLowerCase().trim();

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash)
      return res.status(401).json({ message: 'אימייל או סיסמה שגויים' });

    if (user.isLocked)
      return res.status(423).json({ message: 'החשבון נעול זמנית' });

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      if (typeof user.incrementLoginAttempts === 'function') {
        await user.incrementLoginAttempts();
      }
      return res.status(401).json({ message: 'סיסמה שגויה' });
    }

    if (typeof user.resetLoginAttempts === 'function') {
      await user.resetLoginAttempts();
    }

    createAndSendTokens(user, res);
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
    return res.status(200).json({ message: 'התחברת בהצלחה', user: userPayload });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'שגיאה פנימית בשרת בעת ההתחברות', error: error.message });
  }
};

export const logout = async (req, res) => {
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  };
  res.clearCookie('jwt', cookieOpts);
  res.clearCookie('refreshToken', cookieOpts);
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

    if (!user || user.tokenVersion !== decoded.version) {
      return res.status(403).json({ message: 'Forbidden. Please log in again.' });
    }

    createAndSendTokens(user, res);
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role };
    return res.status(200).json({ message: 'Tokens refreshed successfully', user: userPayload });
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired refresh token.' });
  }
};

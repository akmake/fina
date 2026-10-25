import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { ensurePersonalHousehold } from '../utils/ensureHousehold.js';
import { notifyMany } from '../services/notificationService.js';
import { issueEmailToken, verifyEmailToken } from '../services/verificationService.js';
import {
  generateSecret, buildOtpAuthUrl, qrDataUrl, verifyCode,
  generateRecoveryCodes, hashRecoveryCodes, consumeRecoveryCode,
} from '../services/twoFactorService.js';
import dotenv from 'dotenv';

dotenv.config();

// A short-lived, purpose-scoped token issued after a correct password when 2FA
// is on. It carries an `mfa` claim (NOT a session) — requireAuth rejects it, so
// it can only be exchanged at /api/auth/2fa/login for real tokens.
const signMfaToken = (user) =>
  jwt.sign({ id: user._id, mfa: true }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });

const createAndSendTokens = (user, res) => {
  const accessToken = jwt.sign(
    // tv = tokenVersion: lets requireAuth end a session immediately on
    // block / password change / account deletion (not only at refresh).
    { id: user._id, role: user.role, tv: user.tokenVersion || 0 },
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
    maxAge: 15 * 60 * 1000, // 15 דקות
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ימים
  });
};

const oauth2Client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Access approval ───────────────────────────────────────────────────────
// Sign-up creates a *request*; no session is issued until an admin approves.
const PENDING_RESPONSE = {
  pendingApproval: true,
  message: 'הבקשה התקבלה ותיבדק על ידי מנהל המערכת. נעדכן אותך כשהגישה תאושר.',
};

// Returns an HTTP error tuple when the user may not get a session, else null.
const approvalBlock = (user) => {
  if (user.approvalStatus === 'pending') {
    return [403, { code: 'PENDING_APPROVAL', message: 'הבקשה שלך עדיין ממתינה לאישור מנהל' }];
  }
  if (user.approvalStatus === 'rejected') {
    return [403, { code: 'ACCESS_REJECTED', message: 'בקשת הגישה שלך לא אושרה' }];
  }
  return null;
};

// Tell every platform admin there is a new access request (in-app + email when enabled).
const notifyAdminsOfRequest = async (user) => {
  try {
    const admins = await User.find({ role: 'admin', deletedAt: null }).select('_id').lean();
    await notifyMany(admins.map((a) => ({
      user: a._id,
      type: 'access_request',
      title: 'בקשת הצטרפות חדשה',
      message: `${user.name} (${user.email}) מבקש/ת גישה למערכת`,
      severity: 'info',
      actionUrl: '/admin/users',
      actionLabel: 'לבקשות',
      relatedModel: 'User',
      relatedId: user._id,
      channels: ['inapp', 'email'],
      dedupeKey: `access_request:${user._id}`,
    })));
  } catch (e) {
    console.error('notify admins failed:', e.message);
  }
};

// POST /auth/google — receives either ID token (credential) or access_token
export const googleAuth = async (req, res) => {
  try {
    const { credential, access_token } = req.body;
    if (!credential && !access_token) {
      return res.status(400).json({ message: 'חסר טוקן גוגל' });
    }

    let googleId, email, name, avatar, emailVerified;

    if (credential) {
      // ID token path (GoogleLogin component)
      const ticket = await oauth2Client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      ({ sub: googleId, email, name, picture: avatar, email_verified: emailVerified } = ticket.getPayload());
    } else {
      // Access token path (useGoogleLogin hook). Confirm the token was issued to
      // OUR client before trusting it — otherwise any app's token would work.
      const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(access_token)}`);
      if (!info.ok) return res.status(401).json({ message: 'טוקן גוגל לא תקין' });
      const { aud } = await info.json();
      if (!process.env.GOOGLE_CLIENT_ID || aud !== process.env.GOOGLE_CLIENT_ID) {
        return res.status(401).json({ message: 'טוקן גוגל לא תקין' });
      }
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!resp.ok) return res.status(401).json({ message: 'טוקן גוגל לא תקין' });
      ({ sub: googleId, email, name, picture: avatar, email_verified: emailVerified } = await resp.json());
    }

    if (!email || emailVerified === false || emailVerified === 'false') {
      return res.status(401).json({ message: 'כתובת המייל בחשבון גוגל אינה מאומתת' });
    }
    email = email.toLowerCase().trim();

    if (!googleId) return res.status(401).json({ message: 'טוקן גוגל לא תקין' });
    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        // משתמש קיים עם אותה כתובת — מקשרים את חשבון הגוגל (גוגל כבר אימת את המייל)
        user.googleId = googleId;
        user.avatar = user.avatar || avatar;
        if (!user.emailVerified) {
          // Pre-registration takeover guard: whoever registered this address with a
          // password never proved they own it. Google just did — drop that password
          // and end its sessions, so only the real owner keeps access.
          user.emailVerified = true;
          user.emailVerifiedAt = new Date();
          user.passwordHash = undefined;
          user.tokenVersion = (user.tokenVersion || 0) + 1;
        }
        await user.save();
      } else {
        // משתמש חדש לחלוטין — בקשת גישה שממתינה לאישור מנהל (גוגל אימת את המייל)
        user = await User.create({
          googleId, email, name, avatar, emailVerified: true, emailVerifiedAt: new Date(),
          approvalStatus: 'pending',
        });
        const household = await ensurePersonalHousehold(user);
        user.activeHousehold = household._id;
        await user.save();
        await notifyAdminsOfRequest(user);
        return res.status(202).json(PENDING_RESPONSE);
      }
    }

    const blocked = approvalBlock(user);
    if (blocked) return res.status(blocked[0]).json(blocked[1]);

    // Google sign-in must not bypass the second factor.
    if (user.twoFactorEnabled) {
      return res.status(200).json({ twoFactorRequired: true, mfaToken: signMfaToken(user) });
    }

    createAndSendTokens(user, res);

    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled };
    return res.status(200).json({ message: 'התחברת בהצלחה עם גוגל', user: userPayload });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(401).json({ message: 'ההתחברות עם גוגל נכשלה', error: error.message });
  }
};

export const registerUser = async (req, res) => {
  try {
    let { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'שם, אימייל וסיסמה הם שדות חובה' });
    if (String(password).length < 8)
      return res.status(400).json({ message: 'הסיסמה חייבת להכיל לפחות 8 תווים' });

    email = String(email).toLowerCase().trim();
    name = String(name).trim().slice(0, 100);

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים' });

    const hash = await bcrypt.hash(password, 12);

    // role לעולם לא מגיע מהלקוח — אדמין ראשון נוצר עם createAdmin.js בלבד.
    // ההרשמה היא בקשת גישה: אין סשן עד שמנהל מאשר.
    const user = await User.create({ name, email, passwordHash: hash, role: 'user', approvalStatus: 'pending' });

    // Every new user gets a personal household (their default tenant)
    const household = await ensurePersonalHousehold(user);
    user.activeHousehold = household._id;
    await user.save();

    // Phase 4: send an email-verification link. Best-effort — a failing email
    // must never block signup (and there's no SMTP provider wired in dev).
    try { await issueEmailToken(user); } catch (e) { console.error('verification email failed:', e.message); }

    await notifyAdminsOfRequest(user);
    return res.status(202).json(PENDING_RESPONSE);
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
      return res.status(401).json({ message: 'אימייל או סיסמה שגויים' });
    }

    if (typeof user.resetLoginAttempts === 'function') {
      await user.resetLoginAttempts();
    }

    // Checked only after a correct password, so approval state isn't leaked to guessers.
    const blocked = approvalBlock(user);
    if (blocked) return res.status(blocked[0]).json(blocked[1]);

    // Phase 4: when 2FA is on, stop here — issue only a short-lived mfaToken and
    // require the second factor at /api/auth/2fa/login before real session cookies.
    if (user.twoFactorEnabled) {
      return res.status(200).json({ twoFactorRequired: true, mfaToken: signMfaToken(user) });
    }

    createAndSendTokens(user, res);
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled };
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

// Sign out of EVERY device: bumping tokenVersion invalidates all issued access/refresh tokens.
export const logoutAll = async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  return logout(req, res);
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.tokenVersion !== decoded.version || user.deletedAt || approvalBlock(user)) {
      return res.status(403).json({ message: 'Forbidden. Please log in again.' });
    }

    createAndSendTokens(user, res);
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled };
    return res.status(200).json({ message: 'Tokens refreshed successfully', user: userPayload });
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired refresh token.' });
  }
};

export const updateProfile = async (req, res) => {
  const name = req.body?.name?.trim();
  if (!name) return res.status(400).json({ message: 'שם מלא הוא שדה חובה' });
  if (name.length > 100) return res.status(400).json({ message: 'השם ארוך מדי' });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { name } },
    { new: true, runValidators: true }
  ).select('_id name email role createdAt');

  if (!user) return res.status(404).json({ message: 'המשתמש לא נמצא' });
  return res.json({ user });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'יש להזין סיסמה נוכחית וסיסמה חדשה' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'הסיסמה החדשה חייבת להכיל לפחות 8 תווים' });
  }

  const user = await User.findById(req.user._id);
  if (!user?.passwordHash) {
    return res.status(400).json({ message: 'לחשבון זה אין סיסמה מקומית' });
  }
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return res.status(401).json({ message: 'הסיסמה הנוכחית שגויה' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  createAndSendTokens(user, res);
  return res.json({ message: 'הסיסמה עודכנה בהצלחה' });
};

/*======================================================================
  Phase 4 — Email verification
======================================================================*/

// POST /api/auth/verify-email { token }  (public)
export const verifyEmail = async (req, res) => {
  try {
    const token = req.body?.token || req.query?.token;
    const result = await verifyEmailToken(token);
    if (!result.ok) {
      return res.status(400).json({ message: 'קישור האימות אינו תקין או שפג תוקפו' });
    }
    return res.json({ message: 'כתובת המייל אומתה בהצלחה', emailVerified: true });
  } catch (error) {
    console.error('verifyEmail error:', error);
    return res.status(500).json({ message: 'שגיאה באימות המייל' });
  }
};

// POST /api/auth/resend-verification  (auth)
export const resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    if (user.emailVerified) return res.json({ message: 'כתובת המייל כבר מאומתת', emailVerified: true });
    await issueEmailToken(user);
    return res.json({ message: 'נשלח קישור אימות חדש לכתובת המייל שלך' });
  } catch (error) {
    console.error('resendVerification error:', error);
    return res.status(500).json({ message: 'שגיאה בשליחת קישור האימות' });
  }
};

/*======================================================================
  Phase 4 — Two-factor auth (TOTP)
======================================================================*/

// POST /api/auth/2fa/setup  (auth) — issue a pending secret + QR to scan
export const setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+twoFactorPendingSecret');
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    if (user.twoFactorEnabled) return res.status(400).json({ message: 'אימות דו-שלבי כבר מופעל' });

    const secret = generateSecret();
    user.twoFactorPendingSecret = secret;
    await user.save();

    const otpauth = buildOtpAuthUrl(secret, user.email);
    const qr = await qrDataUrl(otpauth);
    return res.json({ secret, otpauth, qr });
  } catch (error) {
    console.error('2FA setup error:', error);
    return res.status(500).json({ message: 'שגיאה בהגדרת אימות דו-שלבי' });
  }
};

// POST /api/auth/2fa/enable { code }  (auth) — confirm the code, activate, return recovery codes
export const enable2FA = async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ message: 'נדרש קוד אימות' });

    const user = await User.findById(req.user._id).select('+twoFactorPendingSecret +twoFactorSecret +twoFactorRecoveryHashes');
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    if (user.twoFactorEnabled) return res.status(400).json({ message: 'אימות דו-שלבי כבר מופעל' });
    if (!user.twoFactorPendingSecret) return res.status(400).json({ message: 'יש להתחיל את ההגדרה מחדש' });
    if (!verifyCode(user.twoFactorPendingSecret, code)) return res.status(401).json({ message: 'קוד שגוי' });

    const recoveryCodes = generateRecoveryCodes(10);
    user.twoFactorSecret = user.twoFactorPendingSecret;
    user.twoFactorPendingSecret = null;
    user.twoFactorEnabled = true;
    user.twoFactorRecoveryHashes = hashRecoveryCodes(recoveryCodes);
    await user.save();

    // Recovery codes are shown ONCE here — never retrievable again.
    return res.json({ message: 'אימות דו-שלבי הופעל', recoveryCodes });
  } catch (error) {
    console.error('2FA enable error:', error);
    return res.status(500).json({ message: 'שגיאה בהפעלת אימות דו-שלבי' });
  }
};

// POST /api/auth/2fa/disable { code }  (auth) — requires a TOTP or recovery code.
// A password alone is NOT enough: it is the factor 2FA is meant to back up.
export const disable2FA = async (req, res) => {
  try {
    const { code } = req.body || {};
    const user = await User.findById(req.user._id).select('+twoFactorSecret +twoFactorRecoveryHashes');
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    if (!user.twoFactorEnabled) return res.status(400).json({ message: 'אימות דו-שלבי אינו פעיל' });

    let ok = false;
    if (code && verifyCode(user.twoFactorSecret, code)) ok = true;
    if (!ok && code) { const r = consumeRecoveryCode(user.twoFactorRecoveryHashes, code); if (r.ok) ok = true; }
    if (!ok) return res.status(401).json({ message: 'נדרש קוד אימות תקין או קוד שחזור' });

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorPendingSecret = null;
    user.twoFactorRecoveryHashes = [];
    await user.save();
    return res.json({ message: 'אימות דו-שלבי בוטל' });
  } catch (error) {
    console.error('2FA disable error:', error);
    return res.status(500).json({ message: 'שגיאה בביטול אימות דו-שלבי' });
  }
};

// POST /api/auth/2fa/login { mfaToken, code }  (public) — exchange the mfaToken + a
// TOTP (or recovery) code for real session cookies.
export const verify2FALogin = async (req, res) => {
  try {
    const { mfaToken, code } = req.body || {};
    if (!mfaToken || !code) return res.status(400).json({ message: 'חסר טוקן או קוד' });

    let decoded;
    try { decoded = jwt.verify(mfaToken, process.env.JWT_ACCESS_SECRET); }
    catch { return res.status(401).json({ message: 'פג תוקף — התחבר/י מחדש' }); }
    if (!decoded?.mfa) return res.status(401).json({ message: 'טוקן לא תקין' });

    const user = await User.findById(decoded.id).select('+twoFactorSecret +twoFactorRecoveryHashes');
    if (!user || !user.twoFactorEnabled) return res.status(401).json({ message: 'אימות דו-שלבי אינו פעיל' });
    const blocked = approvalBlock(user);
    if (blocked) return res.status(blocked[0]).json(blocked[1]);

    let ok = verifyCode(user.twoFactorSecret, code);
    if (!ok) {
      const r = consumeRecoveryCode(user.twoFactorRecoveryHashes, code);
      if (r.ok) { user.twoFactorRecoveryHashes = r.remaining; await user.save(); ok = true; }
    }
    if (!ok) return res.status(401).json({ message: 'קוד שגוי' });

    createAndSendTokens(user, res);
    const userPayload = { _id: user._id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled };
    return res.status(200).json({ message: 'התחברת בהצלחה', user: userPayload });
  } catch (error) {
    console.error('2FA login error:', error);
    return res.status(500).json({ message: 'שגיאה באימות דו-שלבי' });
  }
};

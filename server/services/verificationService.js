import User from '../models/User.js';
import { generateToken, hashToken } from '../utils/secureToken.js';
import { sendEmail } from './emailService.js';

/**
 * verificationService — email-verification tokens (Phase 4, §onboarding).
 * The raw token is emailed as a link; only its SHA-256 hash is stored, with a
 * 24h expiry. Verification is intentionally non-blocking (nag banner, not a
 * lockout) so existing/Google users aren't stranded.
 */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const clientBase = () => process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * Issue a fresh verification token for a user document, persist its hash, and
 * email the link. Returns { link } so dev/tests can complete the flow without an
 * inbox (the email itself is best-effort via emailService).
 */
export const issueEmailToken = async (user) => {
  const raw = generateToken(32);
  user.emailVerificationTokenHash = hashToken(raw);
  user.emailVerificationExpires = new Date(Date.now() + TOKEN_TTL_MS);
  await user.save();

  const link = `${clientBase()}/verify-email?token=${raw}`;
  await sendEmail({
    to: user.email,
    subject: 'אימות כתובת המייל שלך ב-Fina',
    text: `שלום ${user.name || ''},\n\nלאימות כתובת המייל שלך ב-Fina, היכנס/י לקישור הבא:\n${link}\n\nהקישור תקף ל-24 שעות. אם לא נרשמת ל-Fina, ניתן להתעלם מהודעה זו.`,
    html: `<p>שלום ${user.name || ''},</p>
<p>לאימות כתובת המייל שלך ב-Fina:</p>
<p><a href="${link}">אימות כתובת המייל</a></p>
<p>הקישור תקף ל-24 שעות. אם לא נרשמת ל-Fina, ניתן להתעלם מהודעה זו.</p>`,
  });

  return { link };
};

/**
 * Verify a raw token: match its hash against an unexpired record, mark the user
 * verified, and clear the token. Returns { ok, reason?, user? }.
 */
export const verifyEmailToken = async (rawToken) => {
  if (!rawToken) return { ok: false, reason: 'missing' };

  const user = await User.findOne({
    emailVerificationTokenHash: hashToken(rawToken),
    emailVerificationExpires: { $gt: new Date() },
  });
  if (!user) return { ok: false, reason: 'invalid-or-expired' };

  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  await user.save();

  return { ok: true, user };
};

import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { hashToken } from '../utils/secureToken.js';

/**
 * twoFactorService — TOTP two-factor auth (Phase 4), built on otplib.
 * Allows ±1 time-step of drift so a slightly-off clock still verifies. Secrets
 * and recovery codes live on the User as select:false (recovery codes hashed).
 */

authenticator.options = { window: 1 };

const ISSUER = 'Fina';

export const generateSecret = () => authenticator.generateSecret();

/** otpauth:// URI encoding the secret for authenticator apps. */
export const buildOtpAuthUrl = (secret, accountName) =>
  authenticator.keyuri(accountName || 'user', ISSUER, secret);

/** Render an otpauth URL as a scannable QR data URL (PNG base64). */
export const qrDataUrl = (otpauthUrl) => QRCode.toDataURL(otpauthUrl);

/** Verify a 6-digit TOTP code against a secret. Never throws. */
export const verifyCode = (secret, code) => {
  if (!secret || !code) return false;
  try {
    return authenticator.verify({ token: String(code).replace(/\s+/g, ''), secret });
  } catch {
    return false;
  }
};

/** Generate N human-typable one-time recovery codes (lowercase hex). */
export const generateRecoveryCodes = (n = 10) =>
  Array.from({ length: n }, () => crypto.randomBytes(5).toString('hex'));

export const hashRecoveryCodes = (codes) => codes.map((c) => hashToken(c.trim().toLowerCase()));

/**
 * Consume a recovery code against stored hashes. Returns
 * { ok, remaining } — `remaining` is the hash list minus the used code.
 */
export const consumeRecoveryCode = (hashes, code) => {
  const h = hashToken(String(code).trim().toLowerCase());
  const idx = (hashes || []).indexOf(h);
  if (idx === -1) return { ok: false, remaining: hashes || [] };
  return { ok: true, remaining: hashes.filter((_, i) => i !== idx) };
};

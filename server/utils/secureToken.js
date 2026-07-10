import crypto from 'crypto';

/**
 * Shared helpers for opaque, single-use secrets (email-verification tokens,
 * 2FA recovery codes). We store only the SHA-256 HASH at rest and hand the raw
 * value to the user exactly once — same pattern used for password reset tokens.
 */

/** Cryptographically-random hex token. */
export const generateToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

/** Stable SHA-256 hex hash of a raw token (for at-rest comparison). */
export const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

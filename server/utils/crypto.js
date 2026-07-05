import crypto from 'node:crypto';
import AppError from './AppError.js';
import logger from './logger.js';

/**
 * Symmetric encryption for sensitive at-rest secrets — specifically bank/credit
 * credentials stored on BankConnection (Phase 2, Import 2.0).
 *
 * Algorithm: AES-256-GCM (authenticated encryption — tamper-evident).
 * Key:       FINA_ENCRYPTION_KEY env var, 64 hex chars (32 bytes).
 *            Generate one with:  openssl rand -hex 32
 *
 * Serialized blob format (single string, stored in Mongo):
 *   v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>
 * The version prefix lets us rotate the scheme later without ambiguity.
 */

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce — the GCM standard
const VERSION = 'v1';

let cachedKey; // Buffer | undefined — resolved lazily so import never throws

/**
 * Resolve and validate the 32-byte key from the environment.
 * Throws AppError (500) if the key is missing or malformed, so a misconfigured
 * server surfaces a clear error at encrypt/decrypt time rather than corrupting data.
 */
const getKey = () => {
  if (cachedKey) return cachedKey;

  const raw = process.env.FINA_ENCRYPTION_KEY;
  if (!raw) {
    throw new AppError('הצפנת פרטי התחברות אינה מוגדרת בשרת (FINA_ENCRYPTION_KEY חסר)', 500);
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    throw new AppError('FINA_ENCRYPTION_KEY חייב להיות 64 תווים הקסדצימליים (32 בייטים)', 500);
  }

  cachedKey = Buffer.from(raw.trim(), 'hex');
  return cachedKey;
};

/** Is credential encryption available? Used to gate the auto-sync scheduler. */
export const isEncryptionConfigured = () => {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
};

/**
 * Encrypt a UTF-8 string. Accepts objects too (JSON-serialized first).
 * @param {string|object} plaintext
 * @returns {string} versioned blob (v1:iv:tag:ciphertext, all hex)
 */
export const encrypt = (plaintext) => {
  const key = getKey();
  const text = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
};

/**
 * Decrypt a blob produced by encrypt(). Returns the original UTF-8 string.
 * Throws AppError(500) on any tamper / malformed input / wrong key.
 * @param {string} blob
 * @returns {string}
 */
export const decrypt = (blob) => {
  const key = getKey();
  if (typeof blob !== 'string') {
    throw new AppError('נתון מוצפן לא תקין', 500);
  }

  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new AppError('פורמט הצפנה לא נתמך', 500);
  }
  const [, ivHex, tagHex, dataHex] = parts;

  try {
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plain = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return plain.toString('utf8');
  } catch (err) {
    logger.error(`Credential decryption failed: ${err.message}`);
    throw new AppError('פענוח פרטי התחברות נכשל — ייתכן שמפתח ההצפנה השתנה', 500);
  }
};

/** Convenience: decrypt straight back into a JS object. */
export const decryptJSON = (blob) => JSON.parse(decrypt(blob));

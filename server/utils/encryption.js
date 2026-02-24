import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt sensitive data
 * @param {String} text - Text to encrypt
 * @returns {String} Encrypted text in format: iv:encryptedData
 */
export const encrypt = (text) => {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

/**
 * Decrypt sensitive data
 * @param {String} encryptedText - Encrypted text in format: iv:encryptedData
 * @returns {String} Decrypted text
 */
export const decrypt = (encryptedText) => {
  if (!encryptedText) return null;

  try {
    const [iv, encrypted] = encryptedText.split(':');
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

/**
 * Hash sensitive data (one-way encryption)
 * @param {String} text - Text to hash
 * @returns {String} Hashed text
 */
export const hashData = (text) => {
  if (!text) return null;
  return crypto.createHash('sha256').update(text).digest('hex');
};

/**
 * Generate random token
 * @param {Number} length - Token length in bytes
 * @returns {String} Random token in hex format
 */
export const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

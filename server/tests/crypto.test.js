import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, decryptJSON, isEncryptionConfigured } from '../utils/crypto.js';

describe('הצפנת פרטי התחברות (utils/crypto)', () => {
  it('מזהה שהמפתח מוגדר בסביבת הבדיקות', () => {
    expect(isEncryptionConfigured()).toBe(true);
  });

  it('הצפנה ואז פענוח מחזירים את המחרוזת המקורית', () => {
    const secret = 'סיסמה-סודית-123!@#';
    const blob = encrypt(secret);
    expect(blob).not.toContain(secret);
    expect(blob.startsWith('v1:')).toBe(true);
    expect(decrypt(blob)).toBe(secret);
  });

  it('הצפנת אובייקט מתפענחת בחזרה עם decryptJSON', () => {
    const creds = { username: 'me', password: 'p@ss', num: '4321' };
    const blob = encrypt(JSON.stringify(creds));
    expect(decryptJSON(blob)).toEqual(creds);
  });

  it('כל הצפנה מייצרת ciphertext שונה (IV אקראי)', () => {
    expect(encrypt('same')).not.toBe(encrypt('same'));
  });

  it('שינוי ה-ciphertext (tamper) גורם לפענוח להיכשל', () => {
    const blob = encrypt('data');
    const parts = blob.split(':');
    // הפוך את התו האחרון של ה-ciphertext
    parts[3] = parts[3].slice(0, -1) + (parts[3].endsWith('a') ? 'b' : 'a');
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('פורמט לא תקין נדחה', () => {
    expect(() => decrypt('not-a-valid-blob')).toThrow();
    expect(() => decrypt('v2:aa:bb:cc')).toThrow();
  });
});

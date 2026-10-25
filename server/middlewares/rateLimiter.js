import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

/* Limiter כללי */
export const publicLimiter = isDev
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    });

/* Limiter לנתיבי התחברות — הגנה מפני brute-force על סיסמאות */
export const authLimiter = isDev
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'יותר מדי ניסיונות התחברות. נסה שוב בעוד 15 דקות.' },
    });

/* Limiter לנתיבי סריקת בנקים — כל בקשה מריצה דפדפן, יקר במשאבים */
export const scrapeLimiter = isDev
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'חרגת ממכסת הסנכרונים לשעה. נסה שוב מאוחר יותר.' },
    });

/* Limiter לטלפון המצומד (קודי SMS) — לפי טוקן המכשיר, לא לפי IP, כדי שטלפון
   ודפדפן מאחורי אותו NAT לא יחלקו מכסה */
export const deviceLimiter = isDev
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.get('authorization') || req.ip,
      message: { message: 'יותר מדי בקשות מהמכשיר. נסה שוב מאוחר יותר.' },
    });

/* SMS מהטלפון — מכסה נפרדת וגבוהה: כל קוד עשוי לדרוש כמה ניסיונות חוזרים, ואסור שפעימות
   הלב או בדיקות ידניות יגזלו ממנה */
export const deviceSmsLimiter = isDev
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.get('authorization') || req.ip,
      message: { message: 'יותר מדי הודעות מהמכשיר. נסה שוב מאוחר יותר.' },
    });

/* MCP מרוחק (ChatGPT / Claude.ai) — לפי המפתח שבכתובת; כל שאלה עשויה להפעיל כמה כלים */
export const mcpLimiter = isDev
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.mcpKey || req.ip,
      message: { message: 'יותר מדי בקשות מהעוזר. נסה שוב מאוחר יותר.' },
    });

/* ברירת-מחדל */
export default publicLimiter;

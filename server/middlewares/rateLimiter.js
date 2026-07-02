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

/* ברירת-מחדל */
export default publicLimiter;

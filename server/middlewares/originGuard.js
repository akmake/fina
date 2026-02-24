/**
 * Origin Guard Middleware
 * 
 * חוסם בקשות שלא מגיעות מהאתר עצמו.
 * בודק Origin/Referer headers + custom header שהקליינט שולח.
 * כלי אוטומציה חיצוניים (Make.com, Zapier וכו') לא ידעו לשלוח את ה-header המותאם.
 */

const isProduction = () => process.env.NODE_ENV === 'production';

// רשימת Origins מותרים (אותם כמו ב-CORS)
const getAllowedOrigins = () => [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
  process.env.DEPLOYMENT_URL,
].filter(Boolean);

/**
 * Middleware שמוודא שהבקשה מגיע מהאתר שלנו
 * - בודק שה-Origin או Referer תואמים
 * - בודק שה-custom header X-Fina-Client קיים (רק הקליינט שלנו שולח אותו)
 * - מדלג על בקשות GET/HEAD/OPTIONS (read-only) - לא מסוכנות
 */
export function originGuard(req, res, next) {
  // בפיתוח מקומי — לא חוסם (כדי לא לשבור Postman וכו')
  if (!isProduction()) {
    return next();
  }

  // GET, HEAD, OPTIONS — לא מסוכנות, נותנים לעבור
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // בדיקה 1: Custom Header — רק הקליינט שלנו שולח אותו
  const clientHeader = req.headers['x-fina-client'];
  if (clientHeader !== 'web-app') {
    console.warn(`[OriginGuard] Blocked: missing/invalid X-Fina-Client header from ${req.ip}`);
    return res.status(403).json({ message: 'Access denied.' });
  }

  // בדיקה 2: Origin / Referer תואמים
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const allowedOrigins = getAllowedOrigins();

  const originMatch = allowedOrigins.some(allowed => origin.startsWith(allowed));
  const refererMatch = allowedOrigins.some(allowed => referer.startsWith(allowed));

  if (!originMatch && !refererMatch) {
    console.warn(`[OriginGuard] Blocked: origin="${origin}" referer="${referer}" from ${req.ip}`);
    return res.status(403).json({ message: 'Access denied.' });
  }

  next();
}

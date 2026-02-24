import crypto from 'crypto';

/**
 * CSRF Protection Middleware
 * 
 * גישה: Custom Header Verification
 * 
 * למה זה עובד:
 * - CSRF attacks מגיעים מטפסי HTML רגילים שלא יכולים לשלוח custom headers
 * - בקשות XHR/fetch מאתרים אחרים נחסמות ע"י CORS preflight (רק ה-origin שלנו מותר)
 * - לכן, עצם הנוכחות של custom header (X-Fina-Client) מוכיחה שהבקשה מגיעה מהקליינט שלנו
 * 
 * הגישה הישנה (Double Submit Cookie) נשברה כי cross-origin cookies נחסמים בדפדפנים מודרניים.
 */

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Route handler for GET /api/csrf-token
 * נשאר לתאימות אחורה — הקליינט קורא לו בטעינה.
 */
export function csrfTokenHandler(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.json({ csrfToken: token });
}

/**
 * Middleware שמוודא שהבקשה מגיעה מהקליינט שלנו.
 * בודק נוכחות של custom header שרק הקליינט שולח.
 * CORS preflight מונע מאתרים אחרים לשלוח custom headers.
 */
export function csrfProtection(req, res, next) {
  // GET, HEAD, OPTIONS — read-only, לא מסוכנות
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // בדיקה: custom header שרק הקליינט שלנו שולח
  const clientHeader = req.headers['x-fina-client'];
  
  if (clientHeader !== 'web-app') {
    console.warn('[CSRF] Blocked:', req.method, req.originalUrl,
      '| X-Fina-Client:', clientHeader || 'MISSING',
      '| Origin:', req.headers.origin || 'none');
    return res.status(403).json({ message: 'Access denied — missing security header.' });
  }

  next();
}

import crypto from 'crypto';

/**
 * Custom CSRF protection middleware (replaces deprecated csurf package).
 * Uses the "Double Submit Cookie" pattern:
 *  1. Server generates a random token and stores it in an httpOnly cookie.
 *  2. Client reads the token from /api/csrf-token and sends it in X-CSRF-Token header.
 *  3. Server compares cookie value to header value on state-changing requests.
 */

const isProduction = () => process.env.NODE_ENV === 'production';

// Cookie options for the CSRF cookie
const getCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? 'none' : 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
  partitioned: isProduction(), // תמיכה ב-Safari/iOS (CHIPS)
});

/**
 * Route handler for GET /api/csrf-token
 * Generates a new CSRF token, sets it as a cookie, and returns it in JSON.
 */
export function csrfTokenHandler(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('_csrf', token, getCookieOptions());
  res.json({ csrfToken: token });
}

/**
 * Middleware that verifies CSRF token on state-changing requests.
 * Safe methods (GET, HEAD, OPTIONS) are skipped.
 */
export function csrfProtection(req, res, next) {
  // Skip safe/read-only methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?._csrf;
  const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: 'Invalid or missing CSRF token.' });
  }

  next();
}

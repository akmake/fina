import { UAParser } from 'ua-parser-js';
import Log from '../models/Log.js';

/**
 * Logging Middleware — captures every HTTP request automatically.
 * Runs BEFORE auth so it captures all traffic (including unauthenticated).
 * Saves asynchronously so it doesn't block the response.
 */
const loggingMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Parse user-agent
  const parser = new UAParser(req.headers['user-agent'] || '');
  const uaBrowser = parser.getBrowser();
  const uaOS = parser.getOS();
  const uaDevice = parser.getDevice();
  const uaEngine = parser.getEngine();

  // Extract client-sent metadata from custom headers
  const screenWidth = parseInt(req.headers['x-screen-width']) || null;
  const screenHeight = parseInt(req.headers['x-screen-height']) || null;
  const colorDepth = parseInt(req.headers['x-color-depth']) || null;
  const cores = parseInt(req.headers['x-hw-cores']) || null;
  const memory = parseFloat(req.headers['x-hw-memory']) || null;
  const connectionType = req.headers['x-connection-type'] || '';
  const downlink = parseFloat(req.headers['x-connection-downlink']) || null;
  const rtt = parseInt(req.headers['x-connection-rtt']) || null;
  const language = req.headers['accept-language']?.split(',')[0] || '';
  const sessionId = req.headers['x-session-id'] || '';

  // Get real IP (behind proxy/load-balancer)
  const ipAddress =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown';

  // Capture response details when response finishes
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;

    // Skip logging for health checks, static files, and CSRF token requests
    const skipPaths = ['/api/health', '/api/csrf-token', '/favicon.ico'];
    if (skipPaths.some(p => req.originalUrl.startsWith(p))) return;

    // Determine device type
    let deviceType = 'desktop';
    if (uaDevice.type === 'mobile') deviceType = 'mobile';
    else if (uaDevice.type === 'tablet') deviceType = 'tablet';
    else if (uaDevice.type) deviceType = uaDevice.type;

    // Build log entry
    const logEntry = new Log({
      userId: req.user?.id || req.user?._id || null,
      userName: req.user?.name || null,
      ipAddress,
      userAgent: req.headers['user-agent'] || '',
      browser: {
        name: uaBrowser.name || 'unknown',
        version: uaBrowser.version || '',
      },
      os: {
        name: uaOS.name || 'unknown',
        version: uaOS.version || '',
      },
      device: {
        type: deviceType,
        vendor: uaDevice.vendor || '',
        model: uaDevice.model || '',
      },
      screen: {
        width: screenWidth,
        height: screenHeight,
        colorDepth,
      },
      processor: {
        cores,
        memory,
      },
      page: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      referrer: req.headers['referer'] || req.headers['referrer'] || '',
      language,
      connection: {
        type: connectionType,
        downlink,
        rtt,
      },
      sessionId,
    });

    // Save async — don't block the response
    logEntry.save().catch((err) => {
      console.error('[LoggingMiddleware] Failed to save log:', err.message);
    });
  });

  next();
};

export default loggingMiddleware;

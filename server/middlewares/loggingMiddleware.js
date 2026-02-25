import Log from '../models/Log.js';
import SystemConfig from '../models/SystemConfig.js';
import { UAParser } from 'ua-parser-js';
import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// ★ Device info cache — filled by POST /api/logs/device-ping
// Key = hash(ip + userAgent), Value = { data, timestamp }
export const deviceInfoCache = new Map();
const DEVICE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Helper to create consistent cache key
export const makeDeviceKey = (ip, ua) => {
  return crypto.createHash('md5').update(`${ip}||${ua}`).digest('hex');
};

// Cache for geolocation data to avoid excessive API calls
const geoCache = new Map();
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// נתיבים שלא נרשום לעולם
const SKIP_PREFIXES = ['/api/logs', '/api/csrf-token', '/uploads', '/favicon', '/opo.png'];

// ★ Cache של הגדרת loggingEnabled — כדי לא לפנות ל-DB בכל request
let loggingEnabledCache = false;
let cacheTimestamp = 0;
const CACHE_TTL = 10_000; // רענון כל 10 שניות

const isLoggingEnabled = async () => {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL) return loggingEnabledCache;

  try {
    const config = await SystemConfig.findOne().lean();
    loggingEnabledCache = config?.loggingEnabled === true;
    cacheTimestamp = now;
  } catch (err) {
    // אם DB נפל — משתמשים ב-cache האחרון
  }
  return loggingEnabledCache;
};

// ★ פונקציה חיצונית שמאפשרת לרענן את ה-cache מיד (נקראת כשמשנים הגדרה)
export const refreshLoggingCache = (value) => {
  loggingEnabledCache = value;
  cacheTimestamp = Date.now();
};

// ניקוי IP
const cleanIP = (raw) => {
  if (!raw) return 'unknown';
  let ip = raw;
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
};

// Get geolocation from IP with caching
const getGeolocation = async (ipAddress) => {
  // Skip for localhost
  if (ipAddress === '127.0.0.1' || ipAddress === 'unknown') {
    return { country: 'Local', city: 'Localhost' };
  }

  // Check cache first
  if (geoCache.has(ipAddress)) {
    const cached = geoCache.get(ipAddress);
    if (Date.now() - cached.timestamp < GEO_CACHE_TTL) {
      return cached.data;
    }
    geoCache.delete(ipAddress);
  }

  try {
    // Using ip-api.com free API (45 requests per minute limit)
    const response = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=country,city,region,lat,lon`, {
      timeout: 2000, // 2 seconds timeout
    });

    if (response.data.status === 'success') {
      const location = {
        country: response.data.country || 'Unknown',
        city: response.data.city || 'Unknown',
        region: response.data.region || 'Unknown',
        latitude: response.data.lat || null,
        longitude: response.data.lon || null,
      };

      // Cache the result
      geoCache.set(ipAddress, { data: location, timestamp: Date.now() });
      return location;
    }
  } catch (err) {
    // Silently fail and return default
    console.warn(`Geolocation lookup failed for IP ${ipAddress}: ${err.message}`);
  }

  return { country: 'Unknown', city: 'Unknown' };
};

export const loggingMiddleware = async (req, res, next) => {
  const skip =
    req.method === 'OPTIONS' ||
    SKIP_PREFIXES.some((p) => req.originalUrl.startsWith(p));
  if (skip) return next();

  // ★ בדיקה: אם הלוגים כבויים — ממשיכים בלי לשמור כלום
  const enabled = await isLoggingEnabled();
  if (!enabled) return next();

  try {
    const startTime = Date.now();

    // IP אמיתי מאחורי proxy
    const rawIP = req.headers['cf-connecting-ip']
               || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
               || req.headers['x-real-ip']
               || req.ip
               || req.connection?.remoteAddress
               || 'unknown';
    const ipAddress = cleanIP(rawIP);

    let finalIP = ipAddress;

    const userAgent = req.get('user-agent') || '';
    const referer = req.get('referer') || '';
    const cookieHeader = req.get('cookie') || '';

    // Parse user agent
    let parsed = { browser: {}, os: {}, device: {}, cpu: {} };
    try {
      const parser = new UAParser(userAgent);
      parsed = parser.getResult();
    } catch (err) {
      console.warn('Error parsing user agent:', err.message);
    }

    const userId = req.user?._id || null;

    // ★ If req.user is not set yet (logging runs before auth middleware),
    //   try to extract userId directly from the JWT cookie
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      try {
        const token = req.cookies?.jwt;
        if (token && process.env.JWT_ACCESS_SECRET) {
          const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
          if (decoded?.id) {
            resolvedUserId = new mongoose.Types.ObjectId(decoded.id);
          }
        }
      } catch (e) { /* expired/invalid token — ignore */ }
    }

    // ★ Read client device info from 3 sources (priority order):
    // 1. X-Device-Info header (sent on every request)
    // 2. Server-side device cache (filled by POST /api/logs/device-ping)
    // 3. req.body.logData (legacy fallback)
    let clientData = {};

    // Source 1: Header
    try {
      const headerVal = req.headers['x-device-info'];
      if (headerVal) {
        clientData = JSON.parse(decodeURIComponent(escape(Buffer.from(headerVal, 'base64').toString('binary'))));
      }
    } catch (e) { /* parsing error, try next source */ }

    // Source 2: Device cache (from device-ping endpoint)
    if (!clientData || !Object.keys(clientData).length) {
      try {
        const devKey = makeDeviceKey(ipAddress, userAgent);
        const cached = deviceInfoCache.get(devKey);
        if (cached && (Date.now() - cached.timestamp < DEVICE_CACHE_TTL)) {
          clientData = cached.data;
        }
      } catch (e) { /* ignore */ }
    }

    // Source 3: Body fallback
    if (!clientData || !Object.keys(clientData).length) {
      clientData = req.body?.logData || {};
    }

    // ★ Use client-reported public IP when server-detected IP is localhost
    if (clientData.publicIP && (finalIP === '127.0.0.1' || finalIP === 'unknown' || finalIP === '::1')) {
      finalIP = cleanIP(clientData.publicIP);
    }

    const originalEnd = res.end;
    let isEnded = false;

    res.end = function (...args) {
      if (!isEnded) {
        isEnded = true;
        const responseTime = Date.now() - startTime;

        setImmediate(async () => {
          try {
            // זיהוי device type
            let deviceType = 'unknown';
            if (parsed.device?.type === 'mobile') deviceType = 'mobile';
            else if (parsed.device?.type === 'tablet') deviceType = 'tablet';
            else if (parsed.device?.type) deviceType = parsed.device.type;
            else {
              const ua = userAgent.toLowerCase();
              if (ua.includes('mobile') || (ua.includes('android') && !ua.includes('tablet'))) deviceType = 'mobile';
              else if (ua.includes('tablet') || ua.includes('ipad')) deviceType = 'tablet';
              else deviceType = 'desktop';
            }

            // Get geolocation from IP
            const location = await getGeolocation(finalIP);

            const logEntry = new Log({
              userId: resolvedUserId,
              ipAddress: finalIP,
              userAgent,
              browser: {
                name: parsed.browser?.name || 'Unknown',
                version: parsed.browser?.version || 'Unknown',
              },
              os: {
                name: parsed.os?.name || 'Unknown',
                version: parsed.os?.version || 'Unknown',
                architecture: parsed.cpu?.architecture || clientData.platform || 'Unknown',
              },
              device: deviceType,
              screen: {
                ...(clientData.screen || {}),
                orientation: clientData.screen?.orientation || null,
              },
              processor: {
                cores: clientData.processor?.cores || clientData.hardwareConcurrency || null,
                threads: clientData.processor?.threads || null,
                memory: clientData.processor?.memory || null,
                maxTouchPoints: clientData.processor?.maxTouchPoints || null,
              },
              cookies: {
                enabled: clientData.cookies?.enabled ?? null,
                count: cookieHeader ? cookieHeader.split(';').filter(Boolean).length : 0,
              },
              localStorage: clientData.localStorage || {},
              page: req.originalUrl,
              method: req.method,
              statusCode: res.statusCode,
              responseTime,
              referer,
              userLanguage: clientData.userLanguage || req.get('accept-language')?.split(',')[0] || null,
              languages: clientData.languages || [],
              timezone: clientData.timezone || null,
              connection: clientData.connection || {},
              platform: clientData.platform || parsed.os?.name || null,
              hardwareConcurrency: clientData.hardwareConcurrency || clientData.processor?.cores || null,
              deviceMemory: clientData.deviceMemory || null,
              location,
              // ★ New fields
              gpu: clientData.gpu || null,
              battery: clientData.battery || null,
              prefersDarkMode: clientData.prefersDarkMode ?? null,
              prefersReducedMotion: clientData.prefersReducedMotion ?? null,
              doNotTrack: clientData.doNotTrack ?? null,
              isTouchDevice: clientData.isTouchDevice ?? null,
              session: clientData.session || null,
              mediaDevices: clientData.mediaDevices || null,
              adBlocker: clientData.adBlocker ?? null,
              webdriver: clientData.webdriver ?? null,
              isOnline: clientData.isOnline ?? null,
              pdfViewerEnabled: clientData.pdfViewerEnabled ?? null,
              pluginsCount: clientData.pluginsCount ?? null,
              // ★ Fingerprinting
              fingerprint: clientData.fingerprint || null,
              canvasFingerprint: clientData.canvasFingerprint || null,
              webglFingerprint: clientData.webglFingerprint || null,
              // ★ Browser Capabilities
              webGLSupported: clientData.webGLSupported ?? null,
              serviceWorkerSupported: clientData.serviceWorkerSupported ?? null,
              notificationPermission: clientData.notificationPermission || null,
            });

            await logEntry.save();
          } catch (err) {
            if (!err.message?.includes('buffering timed out')) {
              console.error('Error saving log:', err.message);
            }
          }
        });
      }

      return originalEnd.apply(res, args);
    };

    next();
  } catch (err) {
    console.error('Logging middleware error:', err.message);
    next();
  }
};

export default loggingMiddleware;
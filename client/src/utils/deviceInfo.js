/**
 * ★ Comprehensive Device Intelligence Collector
 * Collects everything possible about the visitor's device, browser, and environment.
 * Data is cached and sent to server via:
 *   1. POST /api/logs/device-ping (on app load — most reliable)
 *   2. X-Device-Info header (on every request — backup)
 */

let _cache = null;
let _initPromise = null;
let _pingDone = false;

// ═══════════════════════════════════════════════════
// FINGERPRINTING HELPERS
// ═══════════════════════════════════════════════════

/** Simple hash function for strings */
const hashCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

/** Canvas fingerprint — same for identical GPU+driver combo */
const getCanvasFingerprint = () => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('FP Test', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('FP Test', 4, 17);
    return hashCode(canvas.toDataURL());
  } catch { return null; }
};

/** WebGL fingerprint — GPU + driver string hash */
const getWebGLFingerprint = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return null;
    const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    return hashCode(`${vendor}~${renderer}`);
  } catch { return null; }
};

/** Generate a comprehensive visitor fingerprint */
const generateFingerprint = () => {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    `${screen.width}x${screen.height}`,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || '',
    navigator.deviceMemory || '',
    navigator.platform || '',
    navigator.maxTouchPoints || 0,
    !!window.indexedDB,
    !!window.sessionStorage,
    !!window.localStorage,
    navigator.plugins?.length || 0,
  ].join('|');
  return hashCode(components);
};

// ═══════════════════════════════════════════════════
// DATA COLLECTORS
// ═══════════════════════════════════════════════════

const collectSync = () => {
  // GPU info
  let gpu = null;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        gpu = {
          vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
          renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
        };
      }
    }
  } catch { /* not available */ }

  // Connection info
  let connection = {};
  try {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c) {
      connection = {
        effectiveType: c.effectiveType || null,
        rtt: c.rtt ?? null,
        downlink: c.downlink ?? null,
        saveData: c.saveData || false,
      };
    }
  } catch { /* not available */ }

  return {
    // ── Screen & Display ──
    screen: {
      width: window.screen?.width || null,
      height: window.screen?.height || null,
      availWidth: window.screen?.availWidth || null,
      availHeight: window.screen?.availHeight || null,
      colorDepth: window.screen?.colorDepth || null,
      pixelDepth: window.screen?.pixelDepth || null,
      isRetina: (window.devicePixelRatio || 1) > 1,
      pixelRatio: window.devicePixelRatio || 1,
      viewportWidth: window.innerWidth || null,
      viewportHeight: window.innerHeight || null,
      orientation: screen.orientation?.type || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'),
    },

    // ── Hardware ──
    processor: {
      cores: navigator.hardwareConcurrency || null,
      maxTouchPoints: navigator.maxTouchPoints || 0,
    },
    deviceMemory: navigator.deviceMemory || null,
    gpu,

    // ── Storage & Cookies ──
    cookies: { enabled: navigator.cookieEnabled ?? false },
    localStorage: {
      enabled: (() => {
        try { const t = '__t__'; localStorage.setItem(t, t); localStorage.removeItem(t); return true; } catch { return false; }
      })(),
    },

    // ── Platform & Identity ──
    platform: navigator.platform || navigator.userAgentData?.platform || 'Unknown',
    userLanguage: navigator.language || navigator.userLanguage || 'Unknown',
    languages: navigator.languages ? [...navigator.languages] : [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),

    // ── Network ──
    connection,
    isOnline: navigator.onLine ?? true,

    // ── User Preferences ──
    isTouchDevice: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
    prefersDarkMode: window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false,
    prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
    doNotTrack: navigator.doNotTrack === '1' || window.doNotTrack === '1',

    // ── Browser Capabilities ──
    pdfViewerEnabled: navigator.pdfViewerEnabled ?? null,
    pluginsCount: navigator.plugins?.length || 0,
    webdriver: navigator.webdriver || false,
    webGLSupported: !!document.createElement('canvas').getContext('webgl'),
    serviceWorkerSupported: 'serviceWorker' in navigator,
    notificationPermission: window.Notification?.permission || null,

    // ── Fingerprints ──
    fingerprint: generateFingerprint(),
    canvasFingerprint: getCanvasFingerprint(),
    webglFingerprint: getWebGLFingerprint(),

    // ── Ad blocker detection ──
    adBlocker: (() => {
      try {
        const el = document.createElement('div');
        el.className = 'adsbox ad-banner textAd ad_wrapper';
        el.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;';
        el.innerHTML = '&nbsp;';
        document.body.appendChild(el);
        const blocked = el.offsetHeight === 0 || el.clientHeight === 0;
        document.body.removeChild(el);
        return blocked;
      } catch { return false; }
    })(),

    // ── Async fields (filled later) ──
    battery: null,
    mediaDevices: null,
    session: null,
    publicIP: null,
  };
};

// ── Async fields ──────────────────────────────────
const resolveAsync = async (info) => {
  const tasks = [];

  // ★ Fetch real public IP from external API
  tasks.push(
    fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d?.ip) info.publicIP = d.ip; })
      .catch(() => {
        // Fallback: try alternative API
        return fetch('https://ipinfo.io/json')
          .then(r => r.json())
          .then(d => { if (d?.ip) info.publicIP = d.ip; })
          .catch(() => {});
      })
  );

  if (navigator.getBattery) {
    tasks.push(
      navigator.getBattery()
        .then(b => { info.battery = { level: Math.round(b.level * 100), charging: b.charging }; })
        .catch(() => {})
    );
  }

  if (navigator.mediaDevices?.enumerateDevices) {
    tasks.push(
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          info.mediaDevices = {
            cameras: devices.filter(d => d.kind === 'videoinput').length,
            microphones: devices.filter(d => d.kind === 'audioinput').length,
            speakers: devices.filter(d => d.kind === 'audiooutput').length,
          };
        })
        .catch(() => {})
    );
  }

  if (tasks.length) await Promise.allSettled(tasks);
};

// ── Session tracking ──────────────────────────────
const getSession = () => {
  try {
    let pv = parseInt(sessionStorage.getItem('_lpc') || '0', 10);
    pv++;
    sessionStorage.setItem('_lpc', String(pv));
    let ss = sessionStorage.getItem('_lss');
    if (!ss) { ss = Date.now().toString(); sessionStorage.setItem('_lss', ss); }
    return {
      pageViews: pv,
      durationSeconds: Math.floor((Date.now() - parseInt(ss, 10)) / 1000),
      isNewSession: pv === 1,
    };
  } catch { return null; }
};

// ═══════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════

/**
 * Initialize — run once at app startup. Resolves async fields, then
 * POSTs the full payload to the server for caching.
 */
export const initDeviceInfo = async () => {
  if (_cache) return _cache;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const info = collectSync();
    await resolveAsync(info);
    info.session = getSession();
    _cache = info;

    // ★ POST full device info to server cache (fire-and-forget)
    if (!_pingDone) {
      _pingDone = true;
      try {
        const baseURL = import.meta.env?.VITE_API_URL || '/api';
        await fetch(`${baseURL}/logs/device-ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(info),
        });
      } catch { /* non-critical */ }
    }

    return _cache;
  })();

  return _initPromise;
};

/**
 * Synchronous getter — returns cached data with fresh session info.
 */
export const collectDeviceInfo = () => {
  if (!_cache) {
    _cache = collectSync();
    resolveAsync(_cache);
  }
  _cache.session = getSession();
  return _cache;
};

export default collectDeviceInfo;
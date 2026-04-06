/**
 * ★ Comprehensive Device Intelligence Collector
 */

let _cache = null;
let _initPromise = null;
let _pingDone = false;

// ═══════════════════════════════════════════════════
// FINGERPRINTING HELPERS
// ═══════════════════════════════════════════════════

const hashCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const getCanvasFingerprint = () => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('FP Test \u2660', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('FP Test \u2660', 4, 17);
    return hashCode(canvas.toDataURL());
  } catch { return null; }
};

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

const getFontFingerprint = () => {
  try {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
      'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
      'Courier New', 'Georgia', 'Impact', 'Segoe UI', 'Tahoma',
      'Times New Roman', 'Trebuchet MS', 'Verdana',
      'Helvetica', 'Palatino', 'Garamond', 'Futura',
    ];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    const available = [];

    const getWidth = (font) => {
      ctx.font = `${testSize} ${font}`;
      return ctx.measureText(testString).width;
    };

    const baseWidths = baseFonts.map(f => getWidth(f));

    for (const font of testFonts) {
      for (let i = 0; i < baseFonts.length; i++) {
        const w = getWidth(`'${font}',${baseFonts[i]}`);
        if (w !== baseWidths[i]) { available.push(font); break; }
      }
    }
    return hashCode(available.join(','));
  } catch { return null; }
};

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
// PERFORMANCE
// ═══════════════════════════════════════════════════

const getPerformanceTiming = () => {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      return {
        pageLoadMs: Math.round(nav.loadEventEnd - nav.startTime),
        domReadyMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        dnsMs: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
        connectMs: Math.round(nav.connectEnd - nav.connectStart),
        ttfbMs: Math.round(nav.responseStart - nav.requestStart),
      };
    }
  } catch { /* ignore */ }
  return null;
};

// ═══════════════════════════════════════════════════
// SYNC COLLECTOR
// ═══════════════════════════════════════════════════

const collectSync = () => {
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

  // UTM parameters from URL
  let utm = null;
  try {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('utm_source');
    const medium = params.get('utm_medium');
    const campaign = params.get('utm_campaign');
    const term = params.get('utm_term');
    const content = params.get('utm_content');
    if (source || medium || campaign) {
      utm = { source, medium, campaign, term, content };
    }
  } catch { /* ignore */ }

  // PWA mode
  let pwaMode = 'browser';
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) pwaMode = 'standalone';
    else if (window.matchMedia('(display-mode: fullscreen)').matches) pwaMode = 'fullscreen';
    else if (window.navigator.standalone === true) pwaMode = 'standalone-ios';
  } catch { /* ignore */ }

  // Storage quota (sync estimate not available — will be async)
  // Screen refresh rate via requestAnimationFrame
  let refreshRate = null;
  try {
    const t1 = performance.now();
    // rough estimate from devicePixelRatio + typical rates
    refreshRate = screen.refreshRate || null;
  } catch { /* ignore */ }

  // Gamepad
  let hasGamepad = false;
  try {
    const gamepads = navigator.getGamepads?.();
    hasGamepad = gamepads ? Array.from(gamepads).some(g => g !== null) : false;
  } catch { /* ignore */ }

  // Number of browser tabs (not accessible directly — use BroadcastChannel trick)
  // Incognito detection attempt
  let privateMode = null;
  try {
    // In incognito, storage quota is typically much smaller
    // Will be filled in async
  } catch { /* ignore */ }

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
      refreshRate,
    },

    // ── Hardware ──
    processor: {
      cores: navigator.hardwareConcurrency || null,
      maxTouchPoints: navigator.maxTouchPoints || 0,
    },
    deviceMemory: navigator.deviceMemory || null,
    gpu,
    hasGamepad,

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
    prefersHighContrast: window.matchMedia?.('(prefers-contrast: high)')?.matches ?? false,
    doNotTrack: navigator.doNotTrack === '1' || window.doNotTrack === '1',

    // ── Browser Capabilities ──
    pdfViewerEnabled: navigator.pdfViewerEnabled ?? null,
    pluginsCount: navigator.plugins?.length || 0,
    webdriver: navigator.webdriver || false,
    webGLSupported: !!document.createElement('canvas').getContext('webgl'),
    webGL2Supported: !!document.createElement('canvas').getContext('webgl2'),
    serviceWorkerSupported: 'serviceWorker' in navigator,
    notificationPermission: window.Notification?.permission || null,
    cookiesEnabled: navigator.cookieEnabled ?? null,
    indexedDBSupported: !!window.indexedDB,

    // ── App Mode ──
    pwaMode,
    utm,

    // ── Performance ──
    performance: getPerformanceTiming(),

    // ── Fingerprints ──
    fingerprint: generateFingerprint(),
    canvasFingerprint: getCanvasFingerprint(),
    webglFingerprint: getWebGLFingerprint(),
    fontFingerprint: getFontFingerprint(),
    audioFingerprint: getAudioFingerprint(),
    speechVoicesFingerprint: getSpeechVoicesFingerprint(),

    // ── Media Codecs ──
    mediaCodecs: getMediaCodecs(),

    // ── Security Indicators ──
    devToolsOpen: detectDevTools(),
    vmIndicators: detectVM(),
    automationIndicators: getNavigatorEntropy(),

    // ── Browser Capabilities (extended) ──
    webAssemblySupported: typeof WebAssembly === 'object',
    sharedArrayBufferSupported: typeof SharedArrayBuffer !== 'undefined',
    bigIntSupported: typeof BigInt !== 'undefined',

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
    localIPs: null,
    storageQuota: null,
    keyboardLayout: null,
    privateMode: null,
    screenRefreshRate: null,
    permissionStates: null,
    cryptoCapabilities: null,
  };
};

// ═══════════════════════════════════════════════════
// ADVANCED FINGERPRINTING
// ═══════════════════════════════════════════════════

const getAudioFingerprint = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    const oscillator = ctx.createOscillator();
    const analyser = ctx.createAnalyser();
    const gain = ctx.createGain();
    const scriptProcessor = ctx.createScriptProcessor(4096, 1, 1);

    oscillator.type = 'triangle';
    oscillator.frequency.value = 10000;
    gain.gain.value = 0;

    oscillator.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(0);

    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(data);
    oscillator.stop();
    ctx.close();

    return hashCode(data.slice(0, 30).join(','));
  } catch { return null; }
};

const getSpeechVoicesFingerprint = () => {
  try {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    if (!voices.length) return null;
    const key = voices.map(v => `${v.name}|${v.lang}|${v.localService}`).join(',');
    return hashCode(key);
  } catch { return null; }
};

const getMediaCodecs = () => {
  try {
    const video = document.createElement('video');
    const codecs = {
      h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"'),
      h265: video.canPlayType('video/mp4; codecs="hvc1"'),
      vp8: video.canPlayType('video/webm; codecs="vp8"'),
      vp9: video.canPlayType('video/webm; codecs="vp9"'),
      av1: video.canPlayType('video/webm; codecs="av01.0.05M.08"'),
      theora: video.canPlayType('video/ogg; codecs="theora"'),
      aac: video.canPlayType('audio/mp4; codecs="mp4a.40.2"'),
      mp3: video.canPlayType('audio/mpeg'),
      opus: video.canPlayType('audio/webm; codecs="opus"'),
      flac: video.canPlayType('audio/flac'),
      vorbis: video.canPlayType('audio/ogg; codecs="vorbis"'),
    };
    return codecs;
  } catch { return null; }
};

const getPermissionStates = async () => {
  const permissions = [
    'camera', 'microphone', 'geolocation',
    'notifications', 'clipboard-read', 'clipboard-write',
    'accelerometer', 'gyroscope', 'magnetometer',
    'payment-handler', 'persistent-storage',
  ];
  const result = {};
  await Promise.allSettled(
    permissions.map(async (name) => {
      try {
        const { state } = await navigator.permissions.query({ name });
        result[name] = state;
      } catch { result[name] = 'unsupported'; }
    })
  );
  return result;
};

const detectDevTools = () => {
  try {
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    return widthDiff || heightDiff;
  } catch { return null; }
};

const detectVM = () => {
  try {
    const clues = [];
    // Hardware concurrency anomaly (VMs often report 1-2)
    if (navigator.hardwareConcurrency <= 2) clues.push('low_cores');
    // Screen size anomaly
    if (screen.width === 1024 && screen.height === 768) clues.push('vm_resolution');
    // Very low device memory
    if (navigator.deviceMemory && navigator.deviceMemory < 1) clues.push('low_memory');
    // WebGL renderer check
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl');
      if (gl) {
        const renderer = gl.getParameter(gl.RENDERER)?.toLowerCase() || '';
        if (renderer.includes('swiftshader') || renderer.includes('llvmpipe') ||
            renderer.includes('virtualbox') || renderer.includes('vmware') ||
            renderer.includes('mesa')) {
          clues.push('software_renderer');
        }
      }
    } catch { /* ignore */ }
    return clues.length > 0 ? clues : null;
  } catch { return null; }
};

const getCryptoCapabilities = async () => {
  try {
    if (!window.crypto?.subtle) return null;
    const algorithms = [
      { name: 'AES-GCM', len: 256 },
      { name: 'AES-CBC', len: 256 },
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      { name: 'ECDH', namedCurve: 'P-256' },
      { name: 'Ed25519' },
    ];
    const supported = [];
    await Promise.allSettled(
      algorithms.map(async (params) => {
        try {
          if (params.len) {
            await crypto.subtle.generateKey({ name: params.name, length: params.len }, false, ['encrypt', 'decrypt']);
          } else if (params.modulusLength) {
            await crypto.subtle.generateKey({ ...params }, false, ['encrypt', 'decrypt']);
          } else if (params.namedCurve) {
            await crypto.subtle.generateKey({ name: params.name, namedCurve: params.namedCurve }, false, ['deriveKey']);
          } else {
            await crypto.subtle.generateKey({ name: params.name }, false, ['sign', 'verify']);
          }
          supported.push(params.name);
        } catch { /* not supported */ }
      })
    );
    return supported;
  } catch { return null; }
};

const getNavigatorEntropy = () => {
  try {
    const props = [];
    const nav = navigator;
    // Check for automation/spoofing indicators
    if ('webdriver' in nav) props.push('webdriver');
    if ('__nightmare' in window) props.push('nightmare');
    if ('_phantom' in window || 'phantom' in window) props.push('phantom');
    if ('callPhantom' in window) props.push('callPhantom');
    if ('__selenium_evaluate' in window) props.push('selenium');
    if ('__webdriverFunc' in window) props.push('webdriverFunc');
    if ('domAutomation' in window) props.push('domAutomation');
    if (window.Buffer !== undefined) props.push('nodeBuffer');
    if (typeof process !== 'undefined') props.push('process');
    // Plugin count anomaly
    if (navigator.plugins?.length === 0) props.push('no_plugins');
    // Language spoofing
    if (navigator.languages?.length === 0) props.push('no_languages');
    return props.length ? props : null;
  } catch { return null; }
};

// ═══════════════════════════════════════════════════
// ASYNC COLLECTORS
// ═══════════════════════════════════════════════════

const getLocalIPs = () => new Promise((resolve) => {
  try {
    const ips = new Set();
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => resolve(null));
    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        pc.close();
        const arr = [...ips].filter(ip => !ip.startsWith('0.') && ip !== '0.0.0.0');
        resolve(arr.length ? arr : null);
        return;
      }
      const match = /(\d{1,3}(\.\d{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(e.candidate.candidate);
      if (match) ips.add(match[1]);
    };
    setTimeout(() => { try { pc.close(); } catch { /* ignore */ } resolve([...ips] || null); }, 2000);
  } catch { resolve(null); }
});

const getScreenRefreshRate = () => new Promise((resolve) => {
  try {
    let last = null;
    let count = 0;
    const diffs = [];
    const measure = (ts) => {
      if (last !== null) diffs.push(ts - last);
      last = ts;
      count++;
      if (count < 10) requestAnimationFrame(measure);
      else {
        const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        resolve(Math.round(1000 / avg));
      }
    };
    requestAnimationFrame(measure);
    setTimeout(() => resolve(null), 3000);
  } catch { resolve(null); }
});

const resolveAsync = async (info) => {
  const tasks = [];

  // Public IP
  const fetchWithTimeout = (url, ms = 5000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { cache: 'no-store', signal: controller.signal }).finally(() => clearTimeout(timer));
  };
  tasks.push(
    fetchWithTimeout('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(d => { if (d?.ip) info.publicIP = d.ip; })
      .catch(() =>
        fetchWithTimeout('https://ipinfo.io/json')
          .then(r => r.json())
          .then(d => { if (d?.ip) info.publicIP = d.ip; })
          .catch(() => {})
      )
  );

  // Battery
  if (navigator.getBattery) {
    tasks.push(
      navigator.getBattery()
        .then(b => {
          info.battery = {
            level: Math.round(b.level * 100),
            charging: b.charging,
            chargingTime: b.chargingTime === Infinity ? null : b.chargingTime,
            dischargingTime: b.dischargingTime === Infinity ? null : b.dischargingTime,
          };
        })
        .catch(() => {})
    );
  }

  // Media devices
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

  // Local IPs via WebRTC
  tasks.push(
    getLocalIPs().then(ips => { info.localIPs = ips; })
  );

  // Storage quota
  if (navigator.storage?.estimate) {
    tasks.push(
      navigator.storage.estimate()
        .then(({ quota, usage }) => {
          info.storageQuota = {
            quotaMB: quota ? Math.round(quota / 1024 / 1024) : null,
            usedMB: usage ? Math.round(usage / 1024 / 1024) : null,
          };
          // Private mode heuristic: quota < 120MB usually means incognito
          if (quota) info.privateMode = quota < 120 * 1024 * 1024;
        })
        .catch(() => {})
    );
  }

  // Keyboard layout
  if (navigator.keyboard?.getLayoutMap) {
    tasks.push(
      navigator.keyboard.getLayoutMap()
        .then(map => {
          // Sample a few keys to identify layout
          const q = map.get('KeyQ');
          const w = map.get('KeyW');
          info.keyboardLayout = q && w ? `${q}${w}` : null;
        })
        .catch(() => {})
    );
  }

  // Screen refresh rate
  tasks.push(
    getScreenRefreshRate().then(rate => { info.screenRefreshRate = rate; })
  );

  // Permission states
  if (navigator.permissions) {
    tasks.push(
      getPermissionStates().then(states => { info.permissionStates = states; }).catch(() => {})
    );
  }

  // Crypto capabilities
  if (window.crypto?.subtle) {
    tasks.push(
      getCryptoCapabilities().then(caps => { info.cryptoCapabilities = caps; }).catch(() => {})
    );
  }

  if (tasks.length) await Promise.allSettled(tasks);
};

// ═══════════════════════════════════════════════════
// SESSION
// ═══════════════════════════════════════════════════

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

export const initDeviceInfo = async () => {
  if (_cache) return _cache;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const info = collectSync();
    await resolveAsync(info);
    info.session = getSession();
    _cache = info;

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

export const collectDeviceInfo = () => {
  if (!_cache) {
    _cache = collectSync();
    resolveAsync(_cache);
  }
  _cache.session = getSession();
  return _cache;
};

export default collectDeviceInfo;

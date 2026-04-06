import mongoose from 'mongoose';

const logSchema = new mongoose.Schema(
  {
    // User info (if logged in)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Visitor info
    ipAddress: String,
    userAgent: String,

    // Browser/Device info (parsed from userAgent)
    browser: {
      name: String,
      version: String,
    },

    os: {
      name: String,
      version: String,
      architecture: String,
    },

    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },

    // Screen/Display info
    screen: {
      width: Number,
      height: Number,
      availWidth: Number,
      availHeight: Number,
      viewportWidth: Number,
      viewportHeight: Number,
      colorDepth: Number,
      pixelDepth: Number,
      pixelRatio: Number,
      refreshRate: Number,
      isRetina: Boolean,
      orientation: String,
    },

    // Processor info
    processor: {
      cores: Number,
      threads: Number,
      memory: Number,
      maxTouchPoints: Number,
    },

    // Cookies & Storage
    cookies: {
      enabled: Boolean,
      count: Number,
    },

    localStorage: {
      enabled: Boolean,
      size: Number,
    },

    // Page visited
    page: String,
    method: String,
    statusCode: Number,

    // Timing
    responseTime: Number,

    // Headers & Request Info
    referer: String,
    userLanguage: String,
    languages: [String],
    timezone: String,

    // Location (from IP geolocation)
    location: {
      country: String,
      countryCode: String,
      city: String,
      region: String,
      zip: String,
      latitude: Number,
      longitude: Number,
      timezone: String,
      isp: String,
      org: String,
      asn: String,
      isMobile: Boolean,
      isProxy: Boolean,
      isHosting: Boolean,
    },

    // Connection Info
    connection: {
      effectiveType: String,
      rtt: Number,
      downlink: Number,
      saveData: Boolean,
    },

    // More Device Details
    platform: String,
    hardwareConcurrency: Number,
    deviceMemory: Number,

    // ★ GPU Info
    gpu: {
      vendor: String,
      renderer: String,
    },

    // ★ Battery Info
    battery: {
      level: Number,
      charging: Boolean,
      chargingTime: Number,
      dischargingTime: Number,
    },

    // ★ User Preferences
    prefersDarkMode: Boolean,
    prefersReducedMotion: Boolean,
    prefersHighContrast: Boolean,
    doNotTrack: Boolean,
    isTouchDevice: Boolean,

    // ★ Session Tracking
    session: {
      pageViews: Number,
      durationSeconds: Number,
      isNewSession: Boolean,
    },

    // ★ Media Devices
    mediaDevices: {
      cameras: Number,
      microphones: Number,
      speakers: Number,
    },

    // ★ Detection Flags
    adBlocker: Boolean,
    webdriver: Boolean,
    isOnline: Boolean,
    pdfViewerEnabled: Boolean,
    pluginsCount: Number,
    hasGamepad: Boolean,
    privateMode: Boolean,

    // ★ Fingerprinting
    fingerprint: String,
    canvasFingerprint: String,
    webglFingerprint: String,
    fontFingerprint: String,
    audioFingerprint: String,
    speechVoicesFingerprint: String,

    // ★ Media Codecs
    mediaCodecs: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ★ Security & Bot Detection
    devToolsOpen: Boolean,
    vmIndicators: [String],
    automationIndicators: [String],

    // ★ Browser Capabilities
    webAssemblySupported: Boolean,
    sharedArrayBufferSupported: Boolean,
    bigIntSupported: Boolean,

    // ★ Permissions
    permissionStates: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ★ Crypto Capabilities
    cryptoCapabilities: [String],

    // ★ Browser Capabilities (legacy)
    webGLSupported: Boolean,
    webGL2Supported: Boolean,
    serviceWorkerSupported: Boolean,
    notificationPermission: String,
    indexedDBSupported: Boolean,

    // ★ Network
    localIPs: [String],

    // ★ Storage
    storageQuota: {
      quotaMB: Number,
      usedMB: Number,
    },

    // ★ App & Marketing
    pwaMode: String,
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },
    keyboardLayout: String,
    screenRefreshRate: Number,

    // ★ Performance
    pagePerformance: {
      pageLoadMs: Number,
      domReadyMs: Number,
      dnsMs: Number,
      connectMs: Number,
      ttfbMs: Number,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'logs',
  }
);

logSchema.index({ timestamp: -1 });
logSchema.index({ userId: 1, timestamp: -1 });
logSchema.index({ ipAddress: 1 });
logSchema.index({ 'browser.name': 1 });
logSchema.index({ device: 1 });
// TTL: מחיקה אוטומטית של לוגים אחרי 90 יום
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model('Log', logSchema);
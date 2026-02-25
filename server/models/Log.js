import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  // --- User Info ---
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  userName: { type: String, default: null },

  // --- Visitor Info ---
  ipAddress: { type: String, default: 'unknown' },
  userAgent: { type: String, default: '' },

  // --- Browser Data ---
  browser: {
    name: { type: String, default: 'unknown' },
    version: { type: String, default: '' },
  },

  // --- OS Data ---
  os: {
    name: { type: String, default: 'unknown' },
    version: { type: String, default: '' },
  },

  // --- Device ---
  device: {
    type: { type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'], default: 'unknown' },
    vendor: { type: String, default: '' },
    model: { type: String, default: '' },
  },

  // --- Screen (from client-side header) ---
  screen: {
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    colorDepth: { type: Number, default: null },
  },

  // --- Processor ---
  processor: {
    cores: { type: Number, default: null },
    memory: { type: Number, default: null }, // navigator.deviceMemory (GB)
  },

  // --- Request Info ---
  page: { type: String, default: '/' },
  method: { type: String, default: 'GET' },
  statusCode: { type: Number, default: 200 },
  responseTime: { type: Number, default: 0 }, // in ms

  // --- Referrer ---
  referrer: { type: String, default: '' },

  // --- Language ---
  language: { type: String, default: '' },

  // --- Connection Info ---
  connection: {
    type: { type: String, default: '' }, // 4g, 3g, wifi, etc.
    downlink: { type: Number, default: null }, // Mbps
    rtt: { type: Number, default: null }, // round-trip time ms
  },

  // --- Location (future enhancement / from IP) ---
  location: {
    country: { type: String, default: '' },
    city: { type: String, default: '' },
  },

  // --- Session ---
  sessionId: { type: String, default: '' },

  // --- Timestamp ---
  timestamp: { type: Date, default: Date.now },
}, {
  timestamps: false,
  versionKey: false,
});

// --- Indices for performance ---
logSchema.index({ timestamp: -1 });
logSchema.index({ userId: 1, timestamp: -1 });
logSchema.index({ ipAddress: 1 });
logSchema.index({ 'device.type': 1 });
logSchema.index({ method: 1, page: 1 });

const Log = mongoose.model('Log', logSchema);
export default Log;

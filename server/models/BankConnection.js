import mongoose from 'mongoose';
import softDelete from '../utils/softDelete.js';

/**
 * BankConnection — a saved link to an Israeli bank / credit-card provider that
 * lets Fina sync transactions unattended (Phase 2, Import 2.0).
 *
 * SECURITY:
 *   - `credentials` and `otpLongTermToken` are AES-256-GCM blobs (see
 *     utils/crypto.js). They are NEVER returned to the client — the toJSON
 *     transform strips them, and controllers only ever expose metadata.
 *   - Decryption happens server-side only, inside the scrape job runner.
 *
 * Scoping: like every business model, isolation flows through the `user` field
 * (+ scopeFilter over household members). `household` is stored for clarity and
 * future physical-tenant scoping.
 */
const bankConnectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', index: true },

    // COMPANY_CONFIG key from services/scrapeService.js (e.g. 'max', 'hapoalim')
    company: { type: String, required: true },
    displayName: { type: String, trim: true, default: '' },

    // Encrypted (v1:iv:tag:ciphertext). credentials = JSON of the company's credFields.
    credentials: { type: String, required: true, select: false },
    // One Zero long-term OTP token (encrypted) — lets auto-sync skip the SMS step.
    otpLongTermToken: { type: String, select: false },

    // 'active' = eligible for auto-sync; 'error' = last sync failed (needs attention);
    // 'disabled' = user paused it; 'needs_otp' = One Zero token expired, re-auth needed.
    status: { type: String, enum: ['active', 'error', 'disabled', 'needs_otp'], default: 'active' },
    autoSync: { type: Boolean, default: true },
    incomesOnly: { type: Boolean, default: false },

    // Last run outcome (denormalized for quick listing)
    lastSyncAt: { type: Date },
    lastSyncStatus: { type: String, enum: ['success', 'error', 'partial', null], default: null },
    lastError: { type: String },
    lastInserted: { type: Number, default: 0 },
    lastSkipped: { type: Number, default: 0 },

    // When the daily scheduler should next attempt this connection.
    nextSyncAt: { type: Date, index: true },
  },
  { timestamps: true }
);

bankConnectionSchema.plugin(softDelete);

bankConnectionSchema.index({ user: 1, company: 1 });

// Defense in depth: never let secrets leak through JSON serialization, even if a
// controller accidentally selects them. (They are also select:false above.)
const stripSecrets = (_doc, ret) => {
  delete ret.credentials;
  delete ret.otpLongTermToken;
  return ret;
};
bankConnectionSchema.set('toJSON', { transform: stripSecrets });
bankConnectionSchema.set('toObject', { transform: stripSecrets });

export default mongoose.model('BankConnection', bankConnectionSchema);

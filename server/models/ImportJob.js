import mongoose from 'mongoose';

/**
 * ImportJob — one execution of a bank sync (Phase 2, Import 2.0).
 *
 * Created when a sync is triggered (manually or by the daily scheduler), then
 * updated as it runs. Acts as the async status record the client polls, and as
 * a history/audit trail of sync outcomes per connection.
 *
 * These are logs, not business data — no soft delete. A TTL index expires them
 * automatically after 90 days.
 */
const importJobSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household' },
    connection: { type: mongoose.Schema.Types.ObjectId, ref: 'BankConnection', index: true },
    company: { type: String, required: true },

    trigger: { type: String, enum: ['manual', 'scheduled'], default: 'manual' },
    // awaiting_otp: the provider sent an SMS code; the job resumes when the paired
    // phone (or the user, on the web) submits it, or expires at otpExpiresAt.
    status: { type: String, enum: ['queued', 'running', 'awaiting_otp', 'success', 'error', 'partial'], default: 'queued', index: true },

    otpRequestedAt: { type: Date },
    otpExpiresAt: { type: Date },
    maskedPhone: { type: String },
    // Codes tried for this job — capped so stray SMS relays can't lock the CAL account.
    otpAttempts: { type: Number, default: 0 },
    // Provider OTP session handle (encrypted, never returned).
    otpSession: { type: String, select: false },

    // Phone-run sync (calAuto): CAL rejects requests from the server's IP, so the
    // paired phone executes the CAL requests the server hands it (services/calDeviceSync.js). While it runs the
    // job stays `awaiting_otp`; deviceStage says how far the phone got.
    runsOn: { type: String, enum: ['server', 'device'], default: 'server' },
    device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
    deviceStage: { type: String, enum: ['waiting_phone', 'requesting', 'waiting_sms', 'fetching'] },
    // Step counter the phone echoes back — a stale/duplicate answer is refused.
    deviceSeq: { type: Number, default: 0 },
    // Server-side state between phone steps (CAL session, auth token, raw data) —
    // encrypted, never returned.
    deviceState: { type: String, select: false },

    startedAt: { type: Date },
    finishedAt: { type: Date },
    durationMs: { type: Number },

    stats: {
      received: { type: Number, default: 0 },
      inserted: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      accounts: { type: Number, default: 0 },
    },
    balances: [{ accountNumber: String, balance: Number, _id: false }],

    error: { type: String },
  },
  { timestamps: true }
);

importJobSchema.index({ user: 1, createdAt: -1 });
importJobSchema.set('toJSON', { transform: (_doc, ret) => { delete ret.otpSession; delete ret.deviceState; return ret; } });
// Auto-clean old job records after 90 days.
importJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export default mongoose.model('ImportJob', importJobSchema);

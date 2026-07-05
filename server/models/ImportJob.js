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
    status: { type: String, enum: ['queued', 'running', 'success', 'error', 'partial'], default: 'queued', index: true },

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
// Auto-clean old job records after 90 days.
importJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export default mongoose.model('ImportJob', importJobSchema);

import mongoose from 'mongoose';

/**
 * Device — a phone paired to a user so it can relay bank SMS one-time codes
 * (CAL) to the server during unattended sync.
 *
 * SECURITY: the device token is shown ONCE at pairing; only its SHA-256 hash is
 * stored (`select:false`). A device token is least-privilege: it can only send a
 * heartbeat and submit an OTP for the owner's waiting sync — it can never read
 * financial data. Revoking sets `revokedAt` (kept for the audit trail).
 */
const deviceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, trim: true, maxlength: 60, default: 'טלפון' },
    tokenHash: { type: String, required: true, unique: true, select: false },
    // First characters of the raw token, so the user can tell devices apart.
    tokenHint: { type: String },
    lastSeenAt: { type: Date },
    lastOtpAt: { type: Date },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

deviceSchema.set('toJSON', { transform: (_doc, ret) => { delete ret.tokenHash; return ret; } });

export default mongoose.model('Device', deviceSchema);

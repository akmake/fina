import mongoose from 'mongoose';

/**
 * ApiKey — a personal, READ-ONLY key that lets an AI assistant (the Fina MCP
 * server in /mcp) query the user's financial data via /api/ai/*.
 *
 * SECURITY: the raw key (`fk_…`) is shown ONCE at creation; only its SHA-256
 * hash is stored (`select:false`). It authorizes /api/ai only — never a session.
 * Read-only unless the user opted into the `categorize` scope, which allows
 * exactly the rename/recategorize endpoints. Revoking sets `revokedAt`.
 */
const apiKeySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, trim: true, maxlength: 60, default: 'עוזר AI' },
    tokenHash: { type: String, required: true, unique: true, select: false },
    tokenHint: { type: String },
    // Extra permissions beyond read. 'categorize' = may rename merchants and
    // change categories via /api/ai/categorize/* (opt-in when creating the key).
    scopes: { type: [String], enum: ['categorize'], default: [] },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

apiKeySchema.set('toJSON', { transform: (_doc, ret) => { delete ret.tokenHash; return ret; } });

export default mongoose.model('ApiKey', apiKeySchema);

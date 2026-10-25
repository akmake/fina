import mongoose from 'mongoose';

/**
 * OAuthCode — a one-time authorization code (10 minutes) issued when the user
 * approves an assistant on the consent page. Stored as a SHA-256 hash, bound to
 * the client, redirect URI and PKCE challenge (S256). Exchanged once at
 * /api/oauth/token; Mongo's TTL index removes it afterwards.
 */
const oauthCodeSchema = new mongoose.Schema(
  {
    codeHash: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    redirectUri: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    scopes: { type: [String], default: [] },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

oauthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OAuthCode', oauthCodeSchema);

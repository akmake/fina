import mongoose from 'mongoose';

/**
 * OAuthClient — an app that registered itself (RFC 7591 Dynamic Client
 * Registration) to connect to Fina's remote MCP, e.g. a ChatGPT or Claude.ai
 * connector. Redirect URIs are limited to an allow-list of assistant hosts
 * (OAUTH_REDIRECT_HOSTS). Confidential clients get a secret, stored hashed only.
 * Contract: docs/modules/ai-mcp.md § OAuth.
 */
const oauthClientSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, unique: true },
    clientName: { type: String, trim: true, maxlength: 100, default: 'עוזר AI' },
    redirectUris: { type: [String], required: true },
    tokenEndpointAuthMethod: { type: String, enum: ['none', 'client_secret_post', 'client_secret_basic'], default: 'none' },
    secretHash: { type: String, select: false },
  },
  { timestamps: true }
);

oauthClientSchema.set('toJSON', { transform: (_doc, ret) => { delete ret.secretHash; return ret; } });

export default mongoose.model('OAuthClient', oauthClientSchema);

import crypto from 'crypto';
import ApiKey from '../models/ApiKey.js';
import OAuthClient from '../models/OAuthClient.js';
import OAuthCode from '../models/OAuthCode.js';
import { audit } from '../utils/audit.js';
import { hashDeviceToken as sha256 } from '../middlewares/deviceAuth.js';

/**
 * OAuth 2.1 authorization server for the remote MCP (/api/mcp), so ChatGPT and
 * Claude.ai connectors can connect with "OAuth": discovery metadata, dynamic
 * client registration, a consent page in the web app, and a token endpoint
 * (authorization_code + PKCE S256, rotating refresh tokens).
 *
 * An approved grant IS an ApiKey (fk_… access token, oauthClient set): it shows
 * up in Settings → "חיבור לעוזר AI", where revoking it disconnects the assistant.
 * Contract: docs/modules/ai-mcp.md § OAuth.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TTL_S = 60 * 60;
const SCOPES = ['read', 'categorize'];
const DEFAULT_REDIRECT_HOSTS = 'chatgpt.com,chat.openai.com,claude.ai,claude.com';

const publicBase = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
const issuer = (req) => `${publicBase(req)}/api/oauth`;
export const mcpResource = (req) => `${publicBase(req)}/api/mcp`;
// Under /api so it works behind a proxy that only forwards /api (also served at /.well-known).
export const resourceMetadataUrl = (req) => `${publicBase(req)}/api/oauth/protected-resource`;

const redirectHosts = () => (process.env.OAUTH_REDIRECT_HOSTS || DEFAULT_REDIRECT_HOSTS)
  .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

// https on an allow-listed assistant host (or a subdomain); http://localhost outside production.
const redirectAllowed = (uri) => {
  let url;
  try { url = new URL(uri); } catch { return false; }
  if (url.hash) return false;
  if (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) {
    return process.env.NODE_ENV !== 'production';
  }
  const host = url.hostname.toLowerCase();
  return url.protocol === 'https:' && redirectHosts().some((h) => host === h || host.endsWith(`.${h}`));
};

const oauthError = (res, status, error, description) =>
  res.status(status).set('Cache-Control', 'no-store').json({ error, error_description: description });

const parseScopes = (scope) => String(scope || '').split(/\s+/).filter((s) => SCOPES.includes(s));
const newToken = (prefix) => `${prefix}${crypto.randomBytes(32).toString('base64url')}`;

// ── Discovery ────────────────────────────────────────────────────────────────

/** RFC 9728 — which authorization server protects /api/mcp. */
export const protectedResourceMetadata = (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600').json({
    resource: mcpResource(req),
    authorization_servers: [issuer(req)],
    scopes_supported: SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'Fina',
  });
};

/** RFC 8414 (also served at the OpenID discovery paths some clients try). */
export const authorizationServerMetadata = (req, res) => {
  const base = issuer(req);
  res.set('Cache-Control', 'public, max-age=3600').json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    scopes_supported: SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    service_documentation: `${publicBase(req)}/settings`,
  });
};

// ── Dynamic client registration (RFC 7591) ───────────────────────────────────

/** POST /api/oauth/register */
export const register = async (req, res, next) => {
  try {
    const body = req.body || {};
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
    if (!redirectUris.length || redirectUris.length > 10) {
      return oauthError(res, 400, 'invalid_redirect_uri', 'redirect_uris is required');
    }
    const bad = redirectUris.find((u) => !redirectAllowed(u));
    if (bad) return oauthError(res, 400, 'invalid_redirect_uri', `redirect URI not allowed: ${bad}`);

    const method = body.token_endpoint_auth_method || 'none';
    if (!['none', 'client_secret_post', 'client_secret_basic'].includes(method)) {
      return oauthError(res, 400, 'invalid_client_metadata', 'unsupported token_endpoint_auth_method');
    }
    const secret = method === 'none' ? null : newToken('fcs_');
    const client = await OAuthClient.create({
      clientId: `fc_${crypto.randomBytes(16).toString('hex')}`,
      clientName: String(body.client_name || 'עוזר AI').trim().slice(0, 100) || 'עוזר AI',
      redirectUris,
      tokenEndpointAuthMethod: method,
      ...(secret && { secretHash: sha256(secret) }),
    });

    res.status(201).set('Cache-Control', 'no-store').json({
      client_id: client.clientId,
      ...(secret && { client_secret: secret, client_secret_expires_at: 0 }),
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: method,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
  } catch (err) { next(err); }
};

// ── Authorization (browser) ──────────────────────────────────────────────────

// Validates an authorization request. Errors that must NOT redirect (unknown
// client / redirect URI) come back as { fatal }; others as { error } to send to the client.
const checkAuthorizeParams = async (q) => {
  const client = q.client_id ? await OAuthClient.findOne({ clientId: String(q.client_id) }).lean() : null;
  if (!client) return { fatal: 'האפליקציה שמבקשת חיבור אינה מוכרת. נסו להוסיף את החיבור מחדש.' };
  const redirectUri = String(q.redirect_uri || (client.redirectUris.length === 1 ? client.redirectUris[0] : ''));
  if (!client.redirectUris.includes(redirectUri) || !redirectAllowed(redirectUri)) {
    return { fatal: 'כתובת החזרה של הבקשה אינה תואמת לאפליקציה. נסו להוסיף את החיבור מחדש.' };
  }
  const base = { client, redirectUri, state: q.state ? String(q.state) : undefined };
  if (q.response_type !== 'code') return { ...base, error: 'unsupported_response_type' };
  if (!q.code_challenge || q.code_challenge_method !== 'S256') {
    return { ...base, error: 'invalid_request', description: 'PKCE with S256 is required' };
  }
  return { ...base, codeChallenge: String(q.code_challenge), scopes: parseScopes(q.scope) };
};

const redirectWith = (redirectUri, params) => {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  return url.toString();
};

/**
 * GET /api/oauth/authorize — validates, then hands the browser to the consent
 * page in the web app (which makes the user log in first if needed).
 */
export const authorize = async (req, res, next) => {
  try {
    const check = await checkAuthorizeParams(req.query);
    if (check.fatal) return res.status(400).type('text/plain; charset=utf-8').send(check.fatal);
    if (check.error) {
      return res.redirect(redirectWith(check.redirectUri, { error: check.error, error_description: check.description, state: check.state }));
    }
    const qs = new URLSearchParams(req.query).toString();
    res.redirect(`${(process.env.CLIENT_URL || '').replace(/\/+$/, '')}/oauth/consent?${qs}`);
  } catch (err) { next(err); }
};

/** GET /api/oauth/consent?<authorize params> (session) — what the consent page shows. */
export const consentInfo = async (req, res, next) => {
  try {
    const check = await checkAuthorizeParams(req.query);
    if (check.fatal || check.error) {
      return res.status(400).json({ message: check.fatal || 'בקשת החיבור אינה תקינה. נסו להוסיף את החיבור מחדש.' });
    }
    res.json({
      clientName: check.client.clientName,
      redirectHost: new URL(check.redirectUri).host,
      requestsCategorize: check.scopes.includes('categorize'),
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/oauth/consent (session) { params, approve, allowCategorize }
 * → { redirectTo } — back to the assistant with a one-time code, or access_denied.
 */
export const consentDecision = async (req, res, next) => {
  try {
    const { params = {}, approve, allowCategorize } = req.body || {};
    const check = await checkAuthorizeParams(params);
    if (check.fatal || check.error) {
      return res.status(400).json({ message: check.fatal || 'בקשת החיבור אינה תקינה. נסו להוסיף את החיבור מחדש.' });
    }
    if (approve !== true) {
      return res.json({ redirectTo: redirectWith(check.redirectUri, { error: 'access_denied', state: check.state }) });
    }

    const code = newToken('fac_');
    const scopes = allowCategorize === true ? ['read', 'categorize'] : ['read'];
    await OAuthCode.create({
      codeHash: sha256(code),
      clientId: check.client.clientId,
      user: req.user._id,
      redirectUri: check.redirectUri,
      codeChallenge: check.codeChallenge,
      scopes,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
    await audit(req, 'aiKey.oauth.approve', 'OAuthClient', { after: { client: check.client.clientName, scopes } });
    res.json({ redirectTo: redirectWith(check.redirectUri, { code, state: check.state }) });
  } catch (err) { next(err); }
};

// ── Token endpoint ───────────────────────────────────────────────────────────

// Client authentication: secret (basic or post) for confidential clients; public
// clients only identify themselves (PKCE protects the code).
const authenticateClient = async (req) => {
  let clientId = req.body?.client_id;
  let secret = req.body?.client_secret;
  const [scheme, value] = (req.get('authorization') || '').split(' ');
  if (scheme === 'Basic' && value) {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    clientId = decodeURIComponent(decoded.slice(0, i));
    secret = decodeURIComponent(decoded.slice(i + 1));
  }
  if (!clientId) return null;
  const client = await OAuthClient.findOne({ clientId: String(clientId) }).select('+secretHash').lean();
  if (!client) return null;
  if (client.tokenEndpointAuthMethod !== 'none') {
    if (!secret || sha256(secret) !== client.secretHash) return null;
  }
  return client;
};

const tokenResponse = (res, { access, refresh, scopes }) => res.set('Cache-Control', 'no-store').set('Pragma', 'no-cache').json({
  access_token: access,
  token_type: 'Bearer',
  expires_in: ACCESS_TTL_S,
  refresh_token: refresh,
  scope: scopes.join(' '),
});

/** POST /api/oauth/token (form or JSON) */
export const token = async (req, res, next) => {
  try {
    const client = await authenticateClient(req);
    if (!client) return oauthError(res, 401, 'invalid_client', 'unknown client or bad credentials');
    const grant = req.body?.grant_type;

    if (grant === 'authorization_code') {
      const { code, redirect_uri: redirectUri, code_verifier: verifier } = req.body;
      if (!code || !verifier) return oauthError(res, 400, 'invalid_request', 'code and code_verifier are required');
      // Single use: mark it used atomically before anything else.
      const row = await OAuthCode.findOneAndUpdate(
        { codeHash: sha256(code), usedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { usedAt: new Date() } },
        { new: true },
      );
      if (!row || row.clientId !== client.clientId || (redirectUri && redirectUri !== row.redirectUri)) {
        return oauthError(res, 400, 'invalid_grant', 'invalid or expired code');
      }
      const challenge = crypto.createHash('sha256').update(String(verifier)).digest('base64url');
      if (challenge !== row.codeChallenge) return oauthError(res, 400, 'invalid_grant', 'PKCE verification failed');

      // One live grant per user + app: reconnecting replaces the previous one.
      await ApiKey.updateMany({ user: row.user, oauthClient: client.clientId, revokedAt: null }, { $set: { revokedAt: new Date() } });
      const access = newToken('fk_');
      const refresh = newToken('fr_');
      const key = await ApiKey.create({
        user: row.user,
        name: client.clientName.slice(0, 60),
        tokenHash: sha256(access),
        tokenHint: access.slice(0, 7),
        scopes: row.scopes.includes('categorize') ? ['categorize'] : [],
        oauthClient: client.clientId,
        expiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000),
        refreshHash: sha256(refresh),
      });
      await audit({ user: { _id: row.user }, ip: req.ip }, 'aiKey.create', 'ApiKey', {
        entityId: key._id, after: { name: key.name, scopes: key.scopes, oauthClient: client.clientId },
      });
      return tokenResponse(res, { access, refresh, scopes: row.scopes });
    }

    if (grant === 'refresh_token') {
      const presented = req.body?.refresh_token;
      if (!presented) return oauthError(res, 400, 'invalid_request', 'refresh_token is required');
      const access = newToken('fk_');
      const refresh = newToken('fr_');
      // Rotate: the presented refresh token works exactly once.
      const key = await ApiKey.findOneAndUpdate(
        { refreshHash: sha256(presented), oauthClient: client.clientId, revokedAt: null },
        { $set: {
          tokenHash: sha256(access),
          tokenHint: access.slice(0, 7),
          refreshHash: sha256(refresh),
          expiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000),
        } },
        { new: true },
      );
      if (!key) return oauthError(res, 400, 'invalid_grant', 'invalid or revoked refresh token');
      return tokenResponse(res, { access, refresh, scopes: ['read', ...key.scopes] });
    }

    return oauthError(res, 400, 'unsupported_grant_type', 'use authorization_code or refresh_token');
  } catch (err) { next(err); }
};

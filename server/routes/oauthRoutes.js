// server/routes/oauthRoutes.js
// OAuth for the remote MCP (ChatGPT / Claude.ai connectors). Mounted in app.js:
//   wellKnownRouter    → /.well-known  (discovery; nginx must forward /.well-known/oauth* + openid-configuration)
//   oauthPublicRouter  → /api/oauth    (before CSRF: called server-to-server by the assistant / via browser redirect)
//   oauthConsentRouter → /api/oauth/consent (requireAuth + CSRF: the consent page in the web app)
// Contract: docs/modules/ai-mcp.md § OAuth

import { Router } from 'express';
import {
  protectedResourceMetadata, authorizationServerMetadata,
  register, authorize, token, consentInfo, consentDecision,
} from '../controllers/oauthController.js';

export const wellKnownRouter = Router();
wellKnownRouter.get(['/oauth-protected-resource', '/oauth-protected-resource/api/mcp'], protectedResourceMetadata);
wellKnownRouter.get([
  '/oauth-authorization-server', '/oauth-authorization-server/api/oauth',
  '/openid-configuration', '/openid-configuration/api/oauth',
], authorizationServerMetadata);

export const oauthPublicRouter = Router();
// ChatGPT/Claude open /authorize in a popup and finish via window.opener. Helmet's
// COOP (same-origin-allow-popups) would sever that link on the first hop → ChatGPT
// shows "Missing OAuth callback data". The consent page (nginx static) sends no COOP.
oauthPublicRouter.use((_req, res, next) => { res.set('Cross-Origin-Opener-Policy', 'unsafe-none'); next(); });
// Same documents under /api, which every proxy already forwards.
oauthPublicRouter.get('/protected-resource', protectedResourceMetadata);
oauthPublicRouter.get(['/.well-known/oauth-authorization-server', '/.well-known/openid-configuration'], authorizationServerMetadata);
oauthPublicRouter.post('/register', register);
oauthPublicRouter.get('/authorize', authorize);
oauthPublicRouter.post('/token', token);

export const oauthConsentRouter = Router();
oauthConsentRouter.get('/', consentInfo);
oauthConsentRouter.post('/', consentDecision);

> Last updated: 2026-10-26
> Status: implemented — read; optional write scope for merchant names + categories

# Module: AI assistant access (MCP)

Lets the user ask an AI assistant about their finances — and, if they opt in,
rename merchants and fix categories. A stdio MCP server (`/mcp`, official
`@modelcontextprotocol/sdk`) calls a dedicated API on the Fina server with a
personal AI key. Setup for users: `mcp/README.md`.

Related canonical docs: [api-reference.md](../api-reference.md) (routes),
[database.md](../database.md) (`ApiKey`), [auth-flow.md](../auth-flow.md) (key auth).

## Pieces

| File | Role |
|------|------|
| `server/models/ApiKey.js` | Personal AI key: SHA-256 `tokenHash` (`select:false`), `tokenHint`, `scopes`, `lastUsedAt`, `revokedAt` |
| `server/middlewares/apiKeyAuth.js` | `Authorization: Bearer fk_…` → owner (active users only); writes only with a scope (`requireAiScope`) |
| `server/controllers/aiController.js` + `routes/aiRoutes.js` | Data endpoints (`/api/ai/*`) + key management (`/api/ai-keys`) |
| `server/services/categorizationService.js` | Rename merchant / set merchant category / set one transaction / rename category — household-scoped, learned via the household's own `CategoryRule` (exact raw description), never the global `MerchantMap` |
| `client/src/components/settings/AiAccessSection.jsx` | Settings → "חיבור לעוזר AI": create (shown once + setup snippets), list, revoke |
| `mcp/index.js`, `mcp/client.js` | The MCP server (6 read + 4 categorize tools) and its HTTP client |

## Security model

- The key reaches `/api/ai/*` only; it is not a session anywhere else, and a
  session cookie or a phone token is not accepted on `/api/ai`.
- **Scopes:** every key reads. Writes need the `categorize` scope (opt-in checkbox at
  creation; shown on the key) and are limited to the four `/categorize/*` endpoints —
  no deletes, transfers or settings. A key without the scope gets 405 on any write.
  Household viewers get 403. Every real change is audited (`ai.*` + the key id);
  `dryRun` previews without changing. Writes need `X-Fina-Client` (global CSRF; the
  MCP client sends it).
- Data is household-scoped exactly like the web (`resolveHousehold` + `scopeFilter`).
- Responses never include credentials, tokens or other users' data. Text search is
  regex-escaped with `maxTimeMS`; rows capped at 200.
- Revoking (`DELETE /api/ai-keys/:id`) works immediately; deleted / blocked owners → 401.
- Rate limit: `deviceLimiter` (30/hour per key in production).
- **Privacy:** whatever the assistant reads goes to the AI provider — stated in the UI.

## Endpoints (`Authorization: Bearer fk_…`)

### Read (GET, any key)

| Path | Params | Returns |
|------|--------|---------|
| `/api/ai/overview` | `month` YYYY-MM (Israel time, default current) | `{ month, income, expense, net, transactionCount, topCategories[], budget[] \| null, connections[], unreadAlerts }` |
| `/api/ai/transactions` | `q`, `category`, `type` income\|expense, `from`/`to` YYYY-MM-DD (to inclusive), `minAmount`, `maxAmount`, `limit` ≤200 | `{ total, returned, transactions[{date, description, amount, type, category, account}] }` |
| `/api/ai/spending` | `groupBy` category\|month\|merchant, `type`, `from`, `to` (default ≈ last 3 months) | `{ from, to, type, groupBy, total, groups[] }` |
| `/api/ai/connections` | — | `[{ name, provider, status, autoSync, dailySyncHourIsrael, nextSyncAt, lastSyncAt, lastSyncOk, lastNewTransactions, problem, waitingForSmsCode }]` |
| `/api/ai/alerts` | — | unread alerts `[{ type, title, message, severity, createdAt }]` |

### Categorize (POST, key with `categorize` scope)

| Path | Body | Effect |
|------|------|--------|
| `/api/ai/categories` (GET) | — | `[{ name, type, transactionCount }]` — defined + used names |
| `/api/ai/categorize/merchant-name` | `{ currentName, newName, dryRun? }` | All transactions with that exact description get the new name; rule learned |
| `/api/ai/categorize/merchant-category` | `{ merchant, category, createIfMissing?, dryRun? }` | All of the merchant's transactions → category; rule learned; 404 for an unknown category unless `createIfMissing` |
| `/api/ai/categorize/transaction-category` | `{ transactionId, category, createIfMissing? }` | One transaction; returns `previousCategory` (undo) |
| `/api/ai/categorize/rename-category` | `{ currentName, newName, dryRun? }` | Renames in transactions, budget items, recurring, goals (`linkedCategory`) and the Category; 409 if the new name exists |

"Learned" = applied by `persistTransactions` on future imports when the incoming row
has no real category yet (existing import precedence is unchanged).

Validation errors → 400 with a Hebrew message (surfaced to the assistant as a tool error).

## Remote MCP (ChatGPT / Claude.ai connectors)

`server/mcp/remoteMcp.js`, mounted in `app.js` before CSRF: `POST https://<fina>/api/mcp/<fk_ key>`
(Streamable HTTP, stateless, JSON responses; GET → 405). Web assistants can't send custom headers, so the
key rides in the URL; `app.js` moves it to `req.mcpKey` before any logger runs and the handler then goes
through `apiKeyAuth` + `resolveHousehold`. Tools call the same `aiController` handlers as `/api/ai/*`
(same scoping, validation, audit); write tools need the `categorize` scope. Rate limit: `mcpLimiter` (600/h per key).
Settings → "חיבור לעוזר AI" shows the ready connector URL once, at key creation.

Two ways to connect:
- **OAuth (recommended):** connector URL `https://<fina>/api/mcp`, Authentication **OAuth** — see § OAuth.
- **Secret URL:** `https://<fina>/api/mcp/<fk_ key>`, Authentication **None** (shown once at key creation).

## OAuth (ChatGPT / Claude.ai "OAuth" connectors)

`server/controllers/oauthController.js` + `routes/oauthRoutes.js`; models `OAuthClient`, `OAuthCode`.
OAuth 2.1 authorization code + PKCE (S256 only), dynamic client registration, rotating refresh tokens.

Flow:
1. `POST /api/mcp` without a token → `401` + `WWW-Authenticate: Bearer resource_metadata="<base>/api/oauth/protected-resource"`.
2. Protected-resource metadata → issuer `<base>/api/oauth`; AS metadata is served at
   `/.well-known/oauth-authorization-server[/api/oauth]`, `/.well-known/openid-configuration[/api/oauth]`
   and `/api/oauth/.well-known/{oauth-authorization-server,openid-configuration}`.
3. `POST /api/oauth/register` (RFC 7591). `redirect_uris` must be https on an allow-listed assistant host
   (`OAUTH_REDIRECT_HOSTS`, default `chatgpt.com,chat.openai.com,claude.ai,claude.com`; http://localhost
   outside production). `token_endpoint_auth_method` `none` (default) or a client secret (stored hashed).
4. `GET /api/oauth/authorize` validates client + exact redirect URI + PKCE, then redirects the browser to
   `<CLIENT_URL>/oauth/consent?<same params>` (`OAuthConsentPage`, protected route → login with `?next=`).
5. The page reads `GET /api/oauth/consent` and posts `POST /api/oauth/consent { params, approve, allowCategorize }`
   (session + CSRF) → `{ redirectTo }` with a one-time code (10 min, hashed) or `error=access_denied`. Audited
   `aiKey.oauth.approve`. Rename/category writes are **off unless the user ticks the box**, whatever the client asked.
6. `POST /api/oauth/token` — `authorization_code` (single use, PKCE checked) creates an **`ApiKey`**
   (`oauthClient` = client id, `expiresAt` +1 h, hashed `refreshHash`); reconnecting the same app revokes the
   previous grant. `refresh_token` rotates access + refresh on the same ApiKey (old refresh dies).
7. The grant is listed in Settings ("מחובר דרך OAuth"); revoking it (`DELETE /api/ai-keys/:id`) cuts the
   assistant off at once (`401 invalid_token`). OAuth grants don't count toward the 5 manual keys.

Rate limit: `oauthLimiter` (300/h; registration per IP, token per client). `PUBLIC_URL` (e.g.
`https://ziporiteem.com`) fixes the URLs in the metadata; without it they come from the request (needs
`X-Forwarded-Proto` from the proxy).

**nginx:** `/.well-known/oauth-*` and `/.well-known/openid-configuration*` must be **proxied to Node**
(not the SPA fallback, which answers `200 text/html` and breaks discovery). Replace the earlier
`location /.well-known/oauth { return 404; }` with:

```nginx
location ~ ^/\.well-known/(oauth-|openid-configuration) {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```
(Leave `/.well-known/acme-challenge` alone.)

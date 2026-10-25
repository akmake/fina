> Last updated: 2026-10-25
> Status: implemented (read-only)

# Module: AI assistant access (MCP)

Lets the user ask an AI assistant about their finances. A stdio MCP server
(`/mcp`, official `@modelcontextprotocol/sdk`) calls a dedicated **read-only**
API on the Fina server with a personal AI key. Setup for users: `mcp/README.md`.

Related canonical docs: [api-reference.md](../api-reference.md) (routes),
[database.md](../database.md) (`ApiKey`), [auth-flow.md](../auth-flow.md) (key auth).

## Pieces

| File | Role |
|------|------|
| `server/models/ApiKey.js` | Personal AI key: SHA-256 `tokenHash` (`select:false`), `tokenHint`, `lastUsedAt`, `revokedAt` |
| `server/middlewares/apiKeyAuth.js` | `Authorization: Bearer fk_…` → owner (active users only); **GET only** (405 otherwise) |
| `server/controllers/aiController.js` + `routes/aiRoutes.js` | Data endpoints (`/api/ai/*`) + key management (`/api/ai-keys`) |
| `client/src/components/settings/AiAccessSection.jsx` | Settings → "חיבור לעוזר AI": create (shown once + setup snippets), list, revoke |
| `mcp/index.js`, `mcp/client.js` | The MCP server (5 tools) and its HTTP client |

## Security model

- The key can only reach `GET /api/ai/*`; it is not a session anywhere else, and a
  session cookie or a phone token is not accepted on `/api/ai`.
- Data is household-scoped exactly like the web (`resolveHousehold` + `scopeFilter`).
- Responses never include credentials, tokens or other users' data. Text search is
  regex-escaped with `maxTimeMS`; rows capped at 200.
- Revoking (`DELETE /api/ai-keys/:id`) works immediately; deleted / blocked owners → 401.
- Rate limit: `deviceLimiter` (30/hour per key in production).
- **Privacy:** whatever the assistant reads goes to the AI provider — stated in the UI.

## Endpoints (all GET, `Authorization: Bearer fk_…`)

| Path | Params | Returns |
|------|--------|---------|
| `/api/ai/overview` | `month` YYYY-MM (Israel time, default current) | `{ month, income, expense, net, transactionCount, topCategories[], budget[] \| null, connections[], unreadAlerts }` |
| `/api/ai/transactions` | `q`, `category`, `type` income\|expense, `from`/`to` YYYY-MM-DD (to inclusive), `minAmount`, `maxAmount`, `limit` ≤200 | `{ total, returned, transactions[{date, description, amount, type, category, account}] }` |
| `/api/ai/spending` | `groupBy` category\|month\|merchant, `type`, `from`, `to` (default ≈ last 3 months) | `{ from, to, type, groupBy, total, groups[] }` |
| `/api/ai/connections` | — | `[{ name, provider, status, autoSync, dailySyncHourIsrael, nextSyncAt, lastSyncAt, lastSyncOk, lastNewTransactions, problem, waitingForSmsCode }]` |
| `/api/ai/alerts` | — | unread alerts `[{ type, title, message, severity, createdAt }]` |

Validation errors → 400 with a Hebrew message (surfaced to the assistant as a tool error).

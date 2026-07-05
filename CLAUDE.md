# CLAUDE.md — Fina Project Intelligence

> ⚠️ MANDATORY: Documentation Update Protocol

## Rules — Every AI Must Follow

- **Rule 1** — Before modifying any file, read `docs/sync-map.md` to find what else must change.
- **Rule 2** — After any code change, update the canonical documentation affected. No exceptions.
- **Rule 3** — If a doc is found to be outdated, update it immediately, even if it was not part of the task.
- **Rule 4** — Every new route, model, env var, store, or module must be documented before the task is complete.
- **Rule 5** — Never duplicate canonical information across documents. Cross-reference only.

---

## Quick Navigation

| Document | Canonical source for |
|----------|---------------------|
| [docs/architecture.md](docs/architecture.md) | env vars, ports, infrastructure, security layers |
| [docs/auth-flow.md](docs/auth-flow.md) | authentication, tokens, middleware, route guards |
| [docs/database.md](docs/database.md) | schemas, models, DB connections |
| [docs/api-reference.md](docs/api-reference.md) | all API routes |
| [docs/state-management.md](docs/state-management.md) | stores, context, state shape |
| [docs/socket-events.md](docs/socket-events.md) | real-time events |
| [docs/contracts.md](docs/contracts.md) | conventions, response formats, naming, patterns |
| [docs/sync-map.md](docs/sync-map.md) | which files change together |
| [docs/known-unknowns.md](docs/known-unknowns.md) | open questions, unclear logic |
| [docs/product-spec-v2.md](docs/product-spec-v2.md) | v2 product re-spec: SaaS direction, roles, modules, build order |
| [docs/modules/](docs/modules/) | per-module deep-dives |

---

## Tech Stack Overview

| Layer | Technology |
|-------|-----------|
| Frontend | React 18.3.1 + Vite 5.2 |
| Routing (client) | React Router DOM 6.23.1 |
| Data fetching | TanStack React Query 5.83 |
| State management | Zustand 4.5.7 |
| Styling | Tailwind CSS 3.4.3 |
| Charts | Recharts 3.1 |
| 3D / Canvas | Three.js 0.183 + Fabric.js 7.2 |
| Animations | Framer Motion 12.23 |
| HTTP client | Axios 1.7.2 |
| Backend | Node.js + Express 4.19.2 |
| Database | MongoDB Atlas (Mongoose 8.4) |
| Auth | JWT (httpOnly cookies) + Google OAuth |
| Security | Helmet, CORS, CSRF (custom header), Rate limiting, AES-256-GCM credential encryption |
| Bank scraping | israeli-bank-scrapers 6.7.9 |
| Language / Direction | Hebrew (RTL), `lang="he" dir="rtl"` |

---

## Critical Routing Rules

- All client routes are defined in [client/src/App.jsx](client/src/App.jsx)
- Default route `/` redirects to `/finance-dashboard`
- Unauthenticated users are redirected to `/login` via `<ProtectedRoute>`
- Admin-only routes are guarded by `requireAdmin` middleware on the server
- Server public routes (no auth): `/api/auth/*` (rate limited), `/api/health`, `/api/csrf-token`, `/api/logs/device-ping` (rate limited)
- Server protected routes: everything else requires `requireAuth` — including `/api/scrape`, `/api/cal`, `/api/import` (also `scrapeLimiter`), and `/api/connections` (`requireAuth` + `familyScope`; its `/:id/sync` adds `scrapeLimiter`)
- CSRF protection is active on all **mutating** requests (POST/PUT/DELETE) — header `X-Fina-Client: web-app` must be present

---

## Port Map

| Service | Port | Notes |
|---------|------|-------|
| Client (dev) | 5173 | Vite dev server |
| Server (API) | 4000 | Express, configurable via `PORT` env |
| MongoDB | Atlas | Cloud, no local port |

---

## Known Pitfalls

- Server entry point is `server/server.js` (env validation + DB connect); `server/app.js` only assembles the Express app (exported for tests)
- Bank scraping routes (`/api/scrape`, `/api/cal`, `/api/import`) require auth + are rate limited — do NOT make them public again
- JWT secrets have no defaults — the server refuses to start without them (and rejects placeholders in production)
- Transaction/Budget/Goal/Loan/Account/BankConnection use **soft delete** (`deletedAt`, `server/utils/softDelete.js`) — never hard-delete these; unique indexes are partial (`deletedAt: null`)
- Import 2.0 (Phase 2): saved bank connections (`BankConnection`) store credentials **encrypted** (AES-256-GCM via `server/utils/crypto.js`, key = `FINA_ENCRYPTION_KEY`, 64 hex chars). Secrets are `select:false` + stripped from JSON — NEVER return them. Unattended daily sync runs via `server/services/importScheduler.js` (started in `server.js`), executing `ImportJob`s through `importRunner`. The scrape core is shared in `server/services/scrapeService.js`; persistence in `server/services/transactionPersistence.js`. Missing `FINA_ENCRYPTION_KEY` → fatal in production, auto-sync disabled in dev. See [docs/modules/import.md](docs/modules/import.md)
- Sensitive actions (deletes, role changes) must call `audit()` from `server/utils/audit.js`
- Tenancy (Phase 1): `Household` + `HouseholdMember` are the tenant layer. `familyScope` (`server/middlewares/familyScope.js`) resolves `req.household`/`req.member` and derives `req.scopeUsers` from active members; data isolation still flows through the per-document `user` field via `utils/scopeFilter.js` (no physical `household` field on business models yet). Viewers are blocked from writes by HTTP method inside `familyScope`. Canonical API is `/api/household`; `/api/family` is a compat shim. New users get a personal household on register (`utils/ensureHousehold.js`); run `npm run migrate:households` for existing data.
- Vite proxy in `vite.config.js` forwards `/api` to `localhost:4000` in dev — production needs a reverse proxy
- The database name is `corse` (not `fina` or `finance`)
- Run server tests with `npm test` inside `server/` (Vitest + Supertest + in-memory Mongo)

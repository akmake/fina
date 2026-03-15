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
| Security | Helmet, CORS, CSRF (custom header), Rate limiting |
| Bank scraping | israeli-bank-scrapers 6.7.1 |
| Language / Direction | Hebrew (RTL), `lang="he" dir="rtl"` |

---

## Critical Routing Rules

- All client routes are defined in [client/src/App.jsx](client/src/App.jsx)
- Default route `/` redirects to `/finance-dashboard`
- Unauthenticated users are redirected to `/login` via `<ProtectedRoute>`
- Admin-only routes are guarded by `requireAdmin` middleware on the server
- Server public routes (no auth): `/api/auth/*`, `/api/import`, `/api/scrape`, `/api/health`, `/api/csrf-token`
- Server protected routes: everything else requires `requireAuth` middleware
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

- `bcrypt` and `bcryptjs` are both listed as dependencies — use `bcrypt` on the server (native binding)
- Bank scraping routes (`/api/scrape`, `/api/cal`) are **public** (no auth) — they rely on user-provided credentials in the request body
- `JWT_ACCESS_SECRET` defaults to a placeholder string — must be changed in production
- Vite proxy in `vite.config.js` forwards `/api` to `localhost:4000` in dev — production needs a reverse proxy
- The database name is `corse` (not `fina` or `finance`)

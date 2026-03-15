> Last updated: 2026-03-12

# Architecture

## Server Architecture

```
client (React + Vite) :5173
        │  HTTP /api/*
        ▼
server (Express) :4000
        │
        ├── Helmet (security headers)
        ├── CORS (origin whitelist from CLIENT_URL)
        ├── express.json / urlencoded (body parsing)
        ├── cookie-parser
        ├── express-mongo-sanitize (NoSQL injection prevention)
        ├── Morgan (HTTP logging)
        ├── loggingMiddleware (visitor analytics)
        │
        ├── PUBLIC routes (no auth, no CSRF):
        │     /api/health
        │     /api/csrf-token
        │     /api/auth/*
        │     /api/import
        │     /api/scrape
        │     /api/cal
        │
        ├── CSRF middleware (X-Fina-Client: web-app header check)
        │
        └── PROTECTED routes (requireAuth + CSRF):
              all other /api/* routes
                    │
                    ▼
              MongoDB Atlas (database: corse)
```

## Ports

| Service | Port | Configurable |
|---------|------|-------------|
| Express API server | 4000 | Yes — `PORT` env var |
| Vite dev client | 5173 | Yes — vite.config.js |
| MongoDB | Atlas cloud | No local port |

## Monorepo Structure

```
fina/
├── package.json          # Root — workspaces: [client, server], scripts
├── client/               # React frontend
│   ├── src/
│   │   ├── main.jsx      # React bootstrap
│   │   ├── App.jsx       # Router + all routes
│   │   ├── pages/        # 50+ page components
│   │   ├── components/   # Reusable UI components
│   │   ├── stores/       # Zustand stores (9 files)
│   │   ├── utils/        # api.js, formatters, engines
│   │   └── hooks/        # Custom React hooks
│   ├── .env              # VITE_* variables
│   └── vite.config.js    # Vite + PWA config, /api proxy
└── server/
    ├── app.js            # Express app entry
    ├── routes/           # Route handlers (46 files)
    ├── controllers/      # Business logic (37 files)
    ├── models/           # Mongoose schemas (30 files)
    ├── middlewares/      # Auth, CSRF, rate limit, logging
    ├── config/           # db.js, routes.js
    ├── utils/            # Helper functions (14 files)
    └── .env              # Server secrets
```

---

## Environment Variables

### Server (`server/.env`)

| Variable | Description | Used in | Breaks if missing |
|----------|-------------|---------|-------------------|
| `PORT` | Express listen port | `server/app.js` | Defaults to 4000 — app still starts |
| `NODE_ENV` | `development` / `production` | `server/app.js`, cookie config | Affects error detail, cookie flags |
| `MONGO_URI` | MongoDB Atlas connection string | `server/config/db.js` | **FATAL** — server crashes on startup |
| `JWT_ACCESS_SECRET` | Secret for signing access JWTs | `server/middlewares/authMiddleware.js`, `server/controllers/authController.js` | **FATAL** — all auth fails |
| `JWT_REFRESH_SECRET` | Secret for signing refresh JWTs | `server/middlewares/requireRefresh.js`, `server/controllers/authController.js` | **FATAL** — token refresh fails, users locked out |
| `JWT_ACCESS_EXPIRES_IN_SECONDS` | Access token TTL (default: 900 = 15min) | `server/controllers/authController.js` | Tokens never expire if unset — security risk |
| `JWT_REFRESH_EXPIRES_IN_SECONDS` | Refresh token TTL (default: 604800 = 7d) | `server/controllers/authController.js` | Same security risk |
| `CLIENT_URL` | Allowed CORS origin | `server/app.js` (CORS config) | CORS blocks all browser requests |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID | `server/controllers/authController.js` | Google login fails silently |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app secret | `server/controllers/authController.js` | Google login fails |

### Client (`client/.env`)

| Variable | Description | Used in | Breaks if missing |
|----------|-------------|---------|-------------------|
| `VITE_API_URL` | Base URL for API calls (`http://localhost:4000/api`) | `client/src/utils/api.js` | **FATAL** — all API calls fail |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID (must match server) | `client/src/pages/LoginPage.jsx` | Google login button fails |
| `VITE_BUILD_TARGET` | Vite build target (default: es2020) | `client/vite.config.js` | Build may fail on old browsers |
| `VITE_DEBUG` | Enable debug logging | `client/src/utils/api.js` (inferred) | No functional impact |

---

## Security Layers

| Layer | Mechanism | File |
|-------|-----------|------|
| Transport | HTTPS (prod) / HTTP (dev) | Infrastructure |
| CORS | Origin whitelist via `CLIENT_URL` | `server/app.js` |
| CSRF | Custom header `X-Fina-Client: web-app` | `server/middlewares/csrf.js` |
| Auth | JWT in httpOnly cookies | `server/middlewares/authMiddleware.js` |
| Rate limiting | express-rate-limit | `server/middlewares/rateLimiter.js` |
| Input sanitization | express-mongo-sanitize (NoSQL injection) | `server/app.js` |
| Security headers | Helmet | `server/app.js` |
| Admin access | `requireAdmin` role check | `server/middlewares/requireAdmin.js` |
| Origin guard | Custom origin validation | `server/middlewares/originGuard.js` |

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `server/app.js` | Middleware stack + route mounting |
| `server/config/db.js` | MongoDB connection setup |
| `client/vite.config.js` | Vite build, PWA, `/api` proxy |
| `client/src/utils/api.js` | Axios instance + interceptors (auth refresh, CSRF) |
| `client/tailwind.config.js` | Design tokens |
| `client/components.json` | shadcn/ui component config |

> Last updated: 2026-07-03

# Auth Flow

## Overview

JWT-based authentication stored in **httpOnly cookies**. Supports email/password and Google OAuth.
Access tokens are short-lived (15 min). Refresh tokens are long-lived (7 days).

---

## Login Flow (Email/Password)

```
User submits form
      │
      ▼
POST /api/auth/login
      │
      ├── Validate credentials (bcrypt compare)
      ├── Generate accessToken (JWT, 15min, JWT_ACCESS_SECRET)
      ├── Generate refreshToken (JWT, 7d, JWT_REFRESH_SECRET)
      └── Set httpOnly cookies:
            jwt=<accessToken>   (short-lived)
            refreshToken=<...>  (long-lived)
      │
      ▼
Client: Zustand authStore.login() → sets user in state
      │
      ▼
React Router: ProtectedRoute allows through → /finance-dashboard
```

## Google OAuth Flow

```
User clicks Google button
      │
      ▼
Google credential response (id_token)
      │
      ▼
POST /api/auth/google  { credential: id_token }
      │
      ├── Verify id_token with google-auth-library
      ├── Find or create User by googleId / email
      ├── Generate JWT pair
      └── Set httpOnly cookies (same as above)
```

## Token Refresh Flow

```
API call returns 401
      │
      ▼
Axios response interceptor (client/src/utils/api.js)
      │
      ├── Queue all pending requests
      ├── POST /api/auth/refresh (sends refreshToken cookie)
      ├── Server validates refreshToken → issues new accessToken cookie
      └── Retry all queued requests
      │
      ▼
If refresh also fails → redirect to /login
```

## Two-Factor Auth (2FA) Login Flow — Phase 4

TOTP via **otplib v12** (`server/services/twoFactorService.js`). When a user has
2FA enabled, the password step does not create a session:

```
POST /api/auth/login  { email, password }
      │  (password OK, user.twoFactorEnabled)
      ▼
200 { twoFactorRequired: true, mfaToken }      ← NO jwt/refresh cookies yet
      │   mfaToken = 5-min JWT with { mfa:true } claim (requireAuth rejects it)
      ▼
Client shows the 6-digit code step (LoginPage)
      │
POST /api/auth/2fa/login  { mfaToken, code }   ← TOTP code, or a one-time recovery code
      │  (verified)
      ▼
Server issues jwt + refresh cookies → normal session
```

Setup (from Settings → `TwoFactorSection`): `POST /2fa/setup` (returns secret +
QR) → `POST /2fa/enable { code }` (activates, returns one-time recovery codes) →
`POST /2fa/disable { code|password }`. Secrets + recovery-code hashes are
`select:false` on `User`.

## Email Verification Flow — Phase 4

Register issues a token (hash stored, raw emailed as `${CLIENT_URL}/verify-email?token=…`
via `verificationService`). The public `POST /api/auth/verify-email { token }` marks
`emailVerified`. **Non-blocking**: a dismissible `VerifyEmailBanner` nags but never
locks the user out; Google-OAuth users are created already-verified.

## CSRF Flow

```
Page load → GET /api/csrf-token  (public, rate-limited)
      │
      ▼
Axios request interceptor adds header:
      X-Fina-Client: web-app
      │
      ▼
Server csrf.js middleware checks header on POST/PUT/DELETE
      │
      ├── Header present → pass through
      └── Header missing → 403 Forbidden
```

If 403 received: Axios interceptor fetches new CSRF token and retries.

---

## Server Middleware Chain (Protected Routes)

```
Request
  → Helmet
  → CORS check
  → Body parser
  → Cookie parser
  → Mongo sanitize
  → Morgan log
  → loggingMiddleware (analytics)
  → [public routes bypass below]
  → CSRF header check (csrf.js)
  → requireAuth (authMiddleware.js)
      └── reads req.cookies.jwt
      └── verifies with JWT_ACCESS_SECRET
      └── sets req.user = { id, _id, role }
  → [admin routes] requireAdmin
      └── checks req.user.role === 'admin'
  → Route handler
```

---

## Client Route Guards

**File:** `client/src/components/ProtectedRoute.jsx`

```
<ProtectedRoute>
  └── reads authStore.user
  └── if null → <Navigate to="/login" />
  └── if present → renders children
```

All pages except `/login` and `/register` are wrapped in `<ProtectedRoute>`.

---

## Auth Middleware Files

| File | Role |
|------|------|
| `server/middlewares/authMiddleware.js` | JWT verification, sets `req.user` |
| `server/middlewares/requireAuth.js` | Alias / enforcement wrapper |
| `server/middlewares/requireAdmin.js` | Role check `req.user.role === 'admin'` |
| `server/middlewares/requireRefresh.js` | Validates refresh token cookie |
| `server/middlewares/csrf.js` | Custom header CSRF protection |
| `server/middlewares/originGuard.js` | Validates request origin |
| `server/middlewares/rateLimiter.js` | Rate limiting (prevents brute force) |
| `client/src/utils/api.js` | Axios instance with auto-refresh interceptor |
| `client/src/stores/authStore.js` | Client auth state (Zustand) |
| `client/src/components/ProtectedRoute.jsx` | Client route guard |

---

## Logout Flow

```
POST /api/auth/logout
  → Server clears jwt and refreshToken cookies
  → authStore.logout() → clears user state
  → Redirect to /login
```

---

## Known Issues / Pitfalls

- JWT secrets have **no defaults** — `server/server.js` refuses to start if `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are missing, and in production also rejects placeholder-looking or short (<32 chars) values
- Bank scraper routes (`/api/scrape`, `/api/cal`, `/api/import`) **require auth** (jwt cookie + CSRF header) and are rate limited (`scrapeLimiter`, 10/hour prod)
- `/api/auth/*` is rate limited (`authLimiter`, 20/15min prod) against brute-force
- `role` is **never accepted from the register request body** — first admin is created with `server/createAdmin.js` only
- Two `requireAuth` implementations exist: `middlewares/authMiddleware.js` (JWT-only, sets `{id,_id,role}` — used in `app.js` mounts) and `middlewares/requireAuth.js` (DB lookup, full user doc — used inside `calRoutes.js`/`transactionRoutes.js`). Consolidation planned for Phase 1 (Household)
- Google Client ID must match between `server/.env` and `client/.env` — mismatch causes silent OAuth failure
- Token refresh uses a queue to prevent race conditions when multiple requests 401 simultaneously

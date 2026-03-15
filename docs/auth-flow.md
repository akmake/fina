> Last updated: 2026-03-12

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

- `JWT_ACCESS_SECRET` defaults to placeholder string `"your-super-secret-access-key-change-it-now"` — **must change in production**
- Bank scraper routes (`/api/scrape`, `/api/cal`) are intentionally **unauthenticated** — they rely on credentials in the request body
- Google Client ID must match between `server/.env` and `client/.env` — mismatch causes silent OAuth failure
- Token refresh uses a queue to prevent race conditions when multiple requests 401 simultaneously

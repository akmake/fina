> Last updated: 2026-03-12

# Module: Auth

## Overview

User registration, login, logout, Google OAuth, and JWT token management.
Hebrew-language UI. Email/password + Google sign-in.

## User Flow

```
/login page
  ├── Fill email + password → POST /api/auth/login
  └── Click Google button → Google credential → POST /api/auth/google

On success:
  → JWT cookies set (httpOnly)
  → authStore.user populated
  → Redirect to /finance-dashboard

On 401:
  → Axios interceptor calls POST /api/auth/refresh
  → On refresh success: retry original request
  → On refresh fail: redirect to /login

/register page → POST /api/auth/register → auto-login → /finance-dashboard
```

## Key Files

| File | Role |
|------|------|
| `server/routes/authRoutes.js` | Route definitions |
| `server/controllers/authController.js` | Business logic (login, register, google, refresh, logout) |
| `server/models/User.js` | User schema (email, password hash, googleId, role) |
| `server/middlewares/authMiddleware.js` | JWT verification, sets `req.user` |
| `server/middlewares/requireRefresh.js` | Validates refresh token cookie |
| `client/src/pages/LoginPage.jsx` | Login UI |
| `client/src/pages/RegisterPage.jsx` | Register UI |
| `client/src/stores/authStore.js` | Client auth state |
| `client/src/components/ProtectedRoute.jsx` | Client route guard |
| `client/src/utils/api.js` | Axios interceptors (auto-refresh on 401) |

## Schema: User

```js
{
  name: String,
  email: String (unique),
  password: String (bcrypt hashed, omitted for Google users),
  googleId: String (for Google OAuth users),
  role: String (enum: 'user' | 'admin', default: 'user'),
  createdAt: Date
}
```

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register, returns user + sets cookies |
| POST | `/api/auth/login` | No | Login, sets JWT cookies |
| POST | `/api/auth/google` | No | Google OAuth |
| POST | `/api/auth/logout` | Yes | Clear cookies |
| POST | `/api/auth/refresh` | Refresh cookie | Issue new access token |

## Schemas Used

See [docs/database.md](../database.md) for full schema reference.

| Model | Key fields used in this module |
|-------|-------------------------------|
| `User` | `email`, `password`, `googleId`, `role`, `name` |

## Coupling

| If you change... | Also update... |
|-----------------|----------------|
| `server/models/User.js` | `server/controllers/authController.js`, `server/middlewares/authMiddleware.js`, `client/src/stores/authStore.js`, `docs/database.md` |
| `server/middlewares/authMiddleware.js` | `client/src/utils/api.js` (interceptor expectations), `docs/auth-flow.md` |
| Cookie name `jwt` | `server/middlewares/authMiddleware.js`, `server/middlewares/requireRefresh.js`, `client/src/utils/api.js`, `docs/auth-flow.md` |
| `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` | Both `server/.env` and `client/.env` must match, `docs/architecture.md` |
| `client/src/stores/authStore.js` | `client/src/components/ProtectedRoute.jsx`, `client/src/components/Navbar.jsx`, `client/src/utils/api.js` |
| `client/src/components/ProtectedRoute.jsx` | `client/src/App.jsx` (all protected routes), `docs/auth-flow.md` |

## Coupling Warnings (narrative)

- `GOOGLE_CLIENT_ID` must match between `server/.env` and `client/.env`
- Cookie name `jwt` is hard-coded in both `authMiddleware.js` and `api.js` interceptor — change both if renaming
- `authStore.js` persists to localStorage — clearing it requires explicit logout (cookies are separate)

## Known Issues / Pitfalls

- JWT secrets in `.env` use placeholder values — **must** be replaced before production
- No email verification on registration
- No password reset flow implemented
- `server/stores/authStore.js` exists — likely legacy/unused, requires clarification

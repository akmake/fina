> Last updated: 2026-07-05
> Status: Phase 4 (SaaS Shell) — in progress

# Module: SaaS Shell — verification, 2FA, account lifecycle, plans

Phase 4 (§11 build order) turns Fina from "works for us" into "a stranger can sign
up, secure their account, and use it without hand-holding". It adds the shell
around the product: email verification, two-factor auth, self-service account
export & deletion, onboarding, and subscription/plan gating.

Related canonical docs (do not duplicate): [auth-flow.md](../auth-flow.md) (tokens,
login), [database.md](../database.md) (schemas), [api-reference.md](../api-reference.md)
(routes), [architecture.md](../architecture.md) (env vars).

---

## Pieces

| File | Role |
|------|------|
| `server/models/User.js` | New fields: `emailVerified`/`emailVerifiedAt`, `emailVerificationTokenHash`/`emailVerificationExpires` (select:false), `onboardedAt`, `twoFactorEnabled`, `twoFactorSecret`/`twoFactorPendingSecret`/`twoFactorRecoveryHashes` (select:false), `deletedAt` |
| `server/models/Subscription.js` | Household-scoped plan record: `household`, `plan` (`free`/`premium`), `status` (`trialing`/`active`/`past_due`/`cancelled`), `provider` (`stub`/`manual`), `periodEnd` |
| `server/services/verificationService.js` | Issue/verify email tokens (raw token to the user, SHA-256 hash at rest) via `emailService` |
| `server/services/twoFactorService.js` | otplib TOTP: generate secret + QR, verify code, recovery codes (hashed) |
| `server/services/accountService.js` | `exportAccountData` (full JSON of the user's data) + `anonymizeAndDelete` (soft-delete business data + scrub the user record) |
| `server/services/subscriptionService.js` | `PLANS` catalog (limits/features), `getOrCreateForHousehold`, `planFor`, `isWithinLimit` |
| `server/middlewares/planGate.js` | `requirePlan(plan)` / `enforceLimit(feature, countFn)` — gate premium features / free-tier caps |
| `server/controllers/accountController.js` | `GET /api/account`, `GET /api/account/export`, `DELETE /api/account`, `POST /api/account/onboarding` |
| `server/controllers/subscriptionController.js` | `GET /api/subscription`, `GET /api/subscription/plans`, `POST /api/subscription/change` (stub) |
| `server/controllers/authController.js` | `verifyEmail`, `resendVerification`, `setup2FA`/`enable2FA`/`disable2FA`, `verify2FALogin`; register now issues a verification token; login now branches on 2FA |
| `client/src/components/VerifyEmailBanner.jsx` | Dismissible "verify your email" nag + resend |
| `client/src/pages/*` | Settings gains 2FA setup, data export, account deletion; Login gains the 2FA step |

---

## Email verification (§ onboarding)

- On register, `verificationService.issueEmailToken(user)` stores a **SHA-256 hash**
  of a random token (raw token is emailed as a link `${CLIENT_URL}/verify-email?token=…`).
- `POST /api/auth/verify-email { token }` (public) — hashes, matches an unexpired
  token, sets `emailVerified=true`. `POST /api/auth/resend-verification` (auth) re-issues.
- Verification is **non-blocking** by design (nag banner, not a lockout) so existing
  users and Google-OAuth users (auto-verified) aren't stranded. A `requireVerifiedEmail`
  guard exists for future hard-gating of sensitive actions.

## Two-factor auth (TOTP, otplib)

- Setup: `POST /api/auth/2fa/setup` → new secret in `twoFactorPendingSecret` + an
  `otpauth://` QR data URL. `POST /api/auth/2fa/enable { code }` verifies the code,
  promotes pending→active, returns one-time **recovery codes** (stored hashed).
  `POST /api/auth/2fa/disable { code|password }` clears it.
- Login: when `twoFactorEnabled`, `POST /api/auth/login` does **not** issue session
  cookies — it returns `{ twoFactorRequired: true, mfaToken }` (a 5-min JWT with an
  `mfa` claim, not an access token). `POST /api/auth/2fa/login { mfaToken, code }`
  verifies the TOTP (or a recovery code) and then issues the real tokens.

## Account lifecycle (self-service)

- `GET /api/account/export` — a single JSON document with the caller's profile +
  every business collection they own (transactions, budgets, goals, …). GDPR portability.
- `DELETE /api/account { password }` — soft-deletes all business data and **scrubs**
  the user record (email→`deleted+<id>@…`, name redacted, secrets/2FA cleared,
  `tokenVersion++` to kill sessions, `deletedAt` set). Refs stay intact so households
  don't break. Not a hard delete (see Gotchas).

## Plans & gating (scaffold — no real billing yet)

- `Subscription` is **per-household** (the billing unit, §A5). `subscriptionService.PLANS`
  defines `free` (default: capped connected accounts / household members) and `premium`.
- `planGate.requirePlan('premium')` / `enforceLimit(...)` guard premium routes and
  free-tier caps. **No payment provider is wired** — `POST /api/subscription/change`
  flips the plan directly (`provider:'stub'`). Real Stripe/Paddle checkout + webhooks
  are a separate, deferred decision (spec Q1).

---

## Gotchas

- Email tokens & 2FA secrets & recovery codes are all `select:false` and **hashed**
  at rest — never return them; only the raw email token leaves (once, in the email link).
- Google-OAuth users are created with `emailVerified=true` (Google already verified it).
- Account deletion is anonymize-in-place, **not** `deleteOne` — a hard delete would
  orphan `Household`/`HouseholdMember`/`AuditLog` references. Business data uses the
  existing soft-delete plugin.
- The 2FA `mfaToken` is a purpose-scoped JWT (`{ mfa:true }`); `requireAuth` rejects it
  for normal routes because it isn't a full access token — keep it that way.
- Plan limits are enforced server-side in `planGate`; the client only *reflects* the
  plan. Never trust a client-sent plan.
- `Subscription` is the **canonical** plan store; the pre-existing `Household.plan`
  is a denormalized mirror (exposed by `/api/household`). `getOrCreateForHousehold`
  seeds a new Subscription from `Household.plan`, and `changePlan` writes both — keep
  them in sync if you add another plan-mutation path.

> Last updated: 2026-10-13
> Status: Audit snapshot (pq-audit). Evidence-based; every finding states how it was verified.
> Scope: whole product at `main` @ 2961e38 + the uncommitted 58-file UI restyle (audited as-is).

# Fina — Product Audit

## Status update — 2026-10-25

Fixed with regression tests (server suite) unless noted:

| ID | Status | Where |
|----|--------|-------|
| P0-1 | ✅ fixed — mfaToken rejected by both `requireAuth`s; 2FA disable needs a code | `tests/verification2fa.test.js` |
| P0-2 | ✅ mitigated — `/api/management` unmounted (files remain, delete later) | `server/app.js` |
| P0-3 | ⛔ **owner action still required** — revoke the GCP key, rotate the admin password, purge history | — |
| P0-4 | ⚠ reduced, not fixed — sign-up now needs admin approval, so a guessed code only helps an already-approved user; code itself unchanged | — |
| P1-2 | ✅ fixed — dedupe includes soft-deleted rows | `tests/autoSync.test.js` |
| P1-4 | ✅ fixed — transient errors stay active + backoff; back-fill from `lastSuccessAt − 7d` | `tests/autoSync.test.js` |
| P1-5 | ✅ fixed in code (aud check, `email_verified`, 2FA step) — not live-tested against Google | `authController.googleAuth` |
| P1-7 | ◑ partial — `/api/import` + `/api/scrape` now behind `familyScope`; `/api/projects` still not | `server/app.js` |
| P1-10 | ◑ partial — dashboard reads the real contract (net worth no longer ₪0, history labels); snapshots / amortized loans still open | `FinanceDashboard.jsx` |
| P2-6 | ✅ fixed — single-flight `409` per connection | `tests/autoSync.test.js` |
| P2-11 | ◑ partial — routes code-split (main JS 2.1 MB → 493 KB); transaction list pagination still open | `App.jsx` |
| P2-13 | ✅ fixed — empty dashboard + brief point to `/connections` | `FinanceDashboard.jsx` |
| P2-17 | ◑ partial — disconnect `$unset`s credentials; consent not recorded yet | `tests/autoSync.test.js` |
| UX-2 | ✅ fixed — Israel-time month boundaries | `tests/dashboard.test.js` |
| UX-3 | ✅ fixed — budget widget reads `budget.items[].spent` | browser-verified |
| UX-4 | ✅ fixed — refresh interceptor skips auth entry routes | browser-verified |
| UX-1 | ◑ contained — `PageErrorBoundary` keeps the shell alive; loans pages themselves not fixed | `Layout.jsx` |
| UX-16 | ◑ partial — dark mode on the new brief/connections verified; other pages not re-checked | — |
| UX-19 | ✅ dashboard links to `/reports` instead of the dead `/smart-analytics` | — |

New since the audit: access approval, daily sync hour, CAL auto-sync via phone
SMS relay, dashboard "what's new" brief, route code-splitting + page error boundary. See
`docs/modules/import.md` and `docs/auth-flow.md`.

## 1. Executive summary

Fina has broad surface area (≈55 routed screens, 40 API routers, spec Phases 1–4 marked done) and a
green server suite (73/73). **It is not safe to put real households on it yet.** Four launch blockers
were found, two reproduced live (2FA bypass; cross-customer data access), plus a private key in the
public repo. Behind them, the **core loop corrupts data silently**: deleted charges return on the next
sync, the balance drifts on every import, auto-sync dies after one transient error, and the dashboard's
headline net worth is always ₪0 and its monthly totals show the wrong month, and the loans pages crash
the whole app. Email is never actually sent, so verification, invites and password
reset cannot work in production. The visual layer is clean and consistent; the **flow** (where to start,
where the core loop lives, what happens after an action) is where users will get lost.

**Recommendation:** freeze feature work; ship slice 1 of §6 (security) first, then slice 2 (data integrity).

## 2. Method & evidence

| Evidence | Result |
|----------|--------|
| `server: npm test` (Vitest + in-memory Mongo) | ✅ 14 files / 73 tests pass (71.7 s) |
| `client: vite build` | ✅ builds; ⚠ one 1.92 MB JS chunk (569 KB gzip), no route code-splitting |
| `client: npm run lint` | ❌ cannot run — no ESLint config in `client/` or repo root |
| CI | ❌ none (`.github/workflows` absent) |
| `npm audit --omit=dev` (workspace) | ❌ 59 vulns: 3 critical (`jspdf` direct; `proxy-addr`, `tar` transitive), 42 high incl. direct `express`, `mongoose` (NoSQL-injection advisory), `axios`, `multer`, `react-router-dom` — non-breaking fixes available; `xlsx` high with **no fix** (client-side parse of user's own files) |
| Live environment | API `server.js` started against **mongodb-memory-server** (Atlas `corse` untouched) + Vite on :5188 |
| Realistic data | Seeded household: owner + partner + viewer (accepted invites), 10 categories, 335 transactions over 6 months, salaries, budget, deposit, car loan, goal, one 1,234,567.89 long-description row |
| Live reproduction scripts | HTTP scripts against the local API for every P0/P1 that could be reproduced locally (results in §4) |
| Browser | Main auditor: register → dashboard → transactions → add form → budget → connections, desktop 1024 px + mobile 375 px. UX reviewer: full journeys with seeded data — see §5 |
| Independent read-only reviewers | security, engineering, product, tests, UX (`pq-*-reviewer`); every P0/P1 re-checked by the main auditor |

Verified legend: **LIVE** = reproduced against the running app · **CODE** = confirmed by reading the full code path · **REVIEW** = reviewer finding, spot-checked only.

## 3. Personas & journeys

| Persona (spec §3) | Frequency | Core jobs |
|-------------------|-----------|-----------|
| Household owner | daily/weekly | see where money went, categorize, keep budget, connect banks, invite spouse |
| Partner (spouse) | weekly | same as owner except billing/ownership |
| Viewer (adult child / accountant) | occasional | read-only dashboards and reports |
| Platform admin | as needed | support, users, logs |

Status classes: **Works** · **Partial** (works but essential step missing) · **Broken** (outcome wrong or blocked) · **Missing-essential** · **Optional/speculative** · **Excluded** (intentional).

| # | Journey | Status | Why (finding IDs) |
|---|---------|--------|-------------------|
| J1 | Sign up → verify email → onboarding → first bank connection → first sync | **Partial / Broken in prod** | register works (LIVE); verification email never sent (P1-11); no onboarding wizard; dashboard CTA leads to one-time import not saved connection (P2-13); zero default categories (P2-1) |
| J2 | Log in securely (password, Google, 2FA) and recover access | **Broken** | 2FA bypass (P0-1, LIVE); Google login unsafe (P1-5); no password reset (P1-8, LIVE); wrong password shows "Forbidden" (UX-4) |
| J3 | Daily: review & categorize transactions, create rule | **Works for owner / Broken for partner** | owner add/edit/search + rule offer work; partner has no categories (UX-5); dashboard shows previous month (UX-2); touch edit hidden (UX-9); drawer not keyboard-modal (UX-8); rules/merchant names shared across customers (P0-2, P1-1); search breaks on `(` (P2-7, LIVE) |
| J4 | Bank sync stays correct over time | **Broken** | deleted rows return (P1-2, LIVE); balance drifts (P1-3, LIVE); sync dies after one error (P1-4); same-day duplicates dropped (P2-3) |
| J5 | Monthly budget cycle & alerts reach the user | **Partial** | budget page correct + manual alert generation works (LIVE: 5 alerts); dashboard budget widget empty (UX-3); alerts go stale after edits (UX-12); no auto-rollover, most alerts only on manual "generate", no nav entry / bell, dismissed alerts return (P1-12, P2-5) |
| J6 | Household: invite partner/viewer, viewer read-only | **Broken** | guessable join code grants partner (P0-4, LIVE); viewer can write via import (P1-7, LIVE); UI lacks role invite/remove/transfer, ownership-transfer dead end, viewer sees all write controls (P1-13, UX-6, UX-7) |
| J7 | Net worth / assets / liabilities | **Broken** | `/my-loans` + loan detail crash the app (UX-1); dashboard net worth ₪0 (P1-10, LIVE); loans at original principal; `/assets`, `/deposits`, `/net-worth` pages work |
| J8 | Goals connected to real data | **Missing-essential (UI)** | server only (P1-14) |
| J9 | Export data / delete account | **Partial** | export works; deletion leaves session alive (P1-6, LIVE), keeps credentials + most data |
| J10 | Plans / billing | **Optional (business decision)** | no payment provider; self-upgrade stub (P2-14) — hide until billing exists |
| J11 | Admin back-office | **Partial** | list/role/delete; delete is a hard delete that leaves bank sync running (P1-6) |
| J12 | "AI" suggestions | **Optional/speculative** | it's a shared feedback board, not AI; leaks user names across customers (P2-15) |
| J13 | Electrical CAD, Pergola, legacy cart/centers | **Excluded** (spec §4.4) | not routed or in nav ✅; dead code remains (P3) |

## 4. Findings

Columns: **Job** = affected user job / journey · **Fix → Test** = minimal fix and the acceptance test that proves it.

### P0 — launch blockers

| ID | Finding | Job | Evidence | Verified | Fix → Test |
|----|---------|-----|----------|----------|------------|
| P0-1 | **2FA bypass → permanent 2FA removal.** `mfaToken` signed with `JWT_ACCESS_SECRET`; `requireAuth` never rejects the `mfa` claim; `2fa/disable` accepts password alone. | J2 | `server/controllers/authController.js:18-19,351`; `server/middlewares/authMiddleware.js:3-24` (also `requireAuth.js`) | **LIVE**: password-only login → mfaToken as `jwt` cookie → `GET /api/transactions` 200, `GET /api/account/export` 200, `POST /2fa/disable` 200 → next login no longer asks for 2FA | Reject tokens with `mfa` in both requireAuth variants; separate secret/`aud` for mfaToken; disable requires TOTP/recovery code → Test: mfaToken cookie on any protected route = 401; disable with password only = 401. |
| P0-2 | **`/api/management` is cross-customer.** Returns every user's Categories / MerchantMaps / CategoryRules; update/delete by id without owner check; `apply-rules` applies everyone's rules. Mounted with `requireAuth` only. Client never calls the API. | J3 | `server/app.js:159`; `server/controllers/managementController.js:12-16,26-49,72-95,103-108` | **LIVE**: user B listed user A's category + rule, `DELETE` of A's rule → 204, gone for A | Delete the router (unused) or scope every query with `scopeFilter` + owner check → Test: B's GET excludes A's items; B's PUT/DELETE on A's ids = 404; DB unchanged. |
| P0-3 | **Secrets in a public repo.** `server/credentials/ca3.json` (GCP service-account private key) tracked despite `.gitignore:32`; admin password hardcoded in `server/createAdmin.js:14` and copied into `directory_structure.txt`. Repo `akmake/fina` is public (unauthenticated GitHub API → 200). | all | `git ls-files`; key field names present (value not printed) | CODE | **Owner action:** revoke key in GCP IAM, rotate that password wherever reused; `git rm --cached`, purge history; admin script reads env → Test: gitleaks in CI fails on these patterns. |
| P0-4 | **Household join code is guessable and grants partner (write).** 8 hex chars (32 bit), never expires, created for every personal household, no rate limit, visible to viewers. | J6 | `server/models/Household.js:29`; `householdController.js:168-199`; `familyController.js:70-99`; `app.js:150-151` | **LIVE**: viewer's `GET /api/household` includes the 8-char `inviteCode`; 40 wrong guesses all 404, never 429 | ≥128-bit, expiring, owner-only code; join creates *pending* membership owner approves; limiter; audit + notify owner → Test: 20 bad guesses → 429; viewer response has no code; join grants no data until approved. |

### P1 — broken or unsafe core journeys

| ID | Finding | Job | Evidence | Verified | Fix → Test |
|----|---------|-----|----------|----------|------------|
| P1-1 | **Categorization shared across customers.** Imports apply `CategoryRule.find({})` (all users) and a global `MerchantMap` (no tenant field, globally unique `originalName`) that any user's rename writes to. | J3, J4 | `server/utils/excelParser.js:151-153`; `models/MerchantMap.js:4-9`; `transactionController.js:320-333,469`; `importController.js:31-44` | CODE | Tenant field on MerchantMap + migration (backup `corse` first), index `(household, originalName)`; scope rules → Test: two users, conflicting rules for one descriptor, each gets their own. |
| P1-2 | **Deleted transactions return on the next sync.** Dedupe find goes through the soft-delete hook; partial unique index allows re-insert; sync re-reads last month. | J4 | `server/services/transactionPersistence.js:124-135`; `utils/softDelete.js:23-31`; `models/Transaction.js:80-83` | **LIVE**: import → delete → import same payload → row back ("נוספו 1 עסקאות חדשות") | `withDeleted` on the dedupe find → Test: persist, soft-delete, persist again → `inserted === 0`. |
| P1-3 | **Balance drifts / is overwritten on import.** `refreshBalances` rewrites `FinanceProfile` from transactions; the user's entered balance is not authoritative and scraper balances are never stored. | J4, J7 | `transactionPersistence.js:67-91`; `netWorthController.js:45,91` | **LIVE**: checking 23,500 → 23,577.70 after import→delete→re-import of one ₪77.70 *expense* (moved the wrong way) | Stop deriving balances from transactions; persist scraper balances per connection → Test: user-set balance unchanged after persist/delete. |
| P1-4 | **One transient bank error disables auto-sync permanently**, no back-fill. | J4 | `server/services/importRunner.js:116-121`; `importScheduler.js:34-38`; `scrapeService.js:335` | CODE | Retryable errors stay `active` with backoff; `error` only for bad credentials; `startDate = lastSuccessAt − 7d` → Test: mocked 504 → connection due next tick; 45-day gap → startDate covers it. |
| P1-5 | **Google login unsafe**: access token accepted without audience check; links to existing account by email without `email_verified`; skips 2FA. | J2 | `authController.js:71-95` | CODE | ID-token flow / tokeninfo `aud` check; require `email_verified`; 2FA users go through mfa step → Test: foreign-app token = 401; 2FA user via Google gets `twoFactorRequired`. |
| P1-6 | **Account deletion leaves the session alive and the data behind.** No `tokenVersion`/`deletedAt` check in `requireAuth`; only 5 collections soft-deleted; encrypted bank credentials kept. Admin delete is a hard delete that leaves BankConnections active → scheduler keeps scraping. | J9, J11 | `services/accountService.js:42-48`; `admin/userAdminController.js:42`; `importScheduler.js:34` | **LIVE**: after `DELETE /api/account` → 200, the old cookie still gets `GET /api/transactions` 200 | tokenVersion check; purge credentials + soft-delete all owned collections; admin uses `anonymizeAndDelete`; scheduler skips deleted owners → Test: same agent after delete = 401; no `credentials` field; `tick()` enqueues 0. |
| P1-7 | **Viewer can write** through routers without `familyScope`: `/api/import`, `/api/scrape`, `/api/management`, `/api/projects`. | J6 | `server/app.js:154,159,181-182` | **LIVE**: viewer `POST /api/transactions` → 403 but `POST /api/import/process-transactions` → 200, owner sees the row | Mount with `familyScope` → Test: viewer-write matrix over every mutating route = 403, counts unchanged. |
| P1-8 | **No password reset.** Button shows "איפוס סיסמה בפיתוח". | J2 | `client/src/pages/LoginPage.jsx:170`; no route in `server/routes/auth.js` | LIVE | Hashed 30-min reset token (reuse `verificationService` pattern), rate-limited, bumps tokenVersion; depends on P1-11 → Test: reset flow end-to-end; token single-use. |
| P1-9 | **Tenant isolation barely tested** — only the transaction list; no by-id matrix, no viewer matrix, no management test. This is how P0-2/P1-7 shipped. | all | `server/tests/isolation.test.js`; `household.test.js:54` | CODE | `it.each` cross-tenant matrix (LIST/GET/PUT/DELETE by foreign id) for every resource + viewer matrix. |
| P1-10 | **Dashboard net worth always ₪0.** API returns `{netWorth, assets, liabilities, …}`; dashboard reads `totalNetWorth`, `totalAssets`, `deposits`; history maps `h.date` vs server `label`; no snapshot is ever created; loans counted at original principal; FX hardcoded `×3.7`. | J7 | `server/controllers/netWorthController.js:53,85,116-122,403-408`; `client/src/pages/FinanceDashboard.jsx:238-266,315` | **LIVE**: API `netWorth = −3,523.74`, `totalNetWorth` undefined (seeded deposit 50k, loan 80k) | Align contract; daily snapshot in scheduler; amortized remaining balance → Test: ₪10k deposit shows ₪10k on dashboard; 2 days → 2 history points. |
| P1-11 | **Email never sent but reported delivered.** `EMAIL_ENABLED=true` → logs and returns `{delivered:true}` (TODO transport). Verification, invites, failed-sync emails can't work in production. | J1, J6 | `server/services/emailService.js:31-33` | CODE | Real transport (Resend/SES); `delivered:false` until then → Test: transport mock receives the verification link; failure surfaces. |
| P1-12 | **"Insight → action" needs manual triggers.** Client never calls `/budgets/rollover`; scheduler only checks months that have a Budget; insurance/deposit/goal/duplicate alerts only on manual "generate"; no monthly summary; partner can't dismiss household alerts. | J5 | `budgetScheduler.js:39`; `AlertsPage.jsx:39` → `alertController.js:36,52,62` | LIVE (manual generate → 5 alerts; none existed before) + CODE | Auto-rollover + scheduled `generateAlerts`; bell with unread count; dismiss via `scopeFilter` → Test: new month with no budget → budget rolled + thresholds checked. |
| P1-13 | **Household management UI incomplete; no viewer UX.** `FamilyPage` uses only the `/family` shim (join code); no email invite w/ role, remove, change role, transfer ownership. Viewer sees all write buttons. Owner can delete account while members remain. | J6 | `client/src/pages/FamilyPage.jsx`; `server/routes/householdRoutes.js:28-35`; `accountService.js:103` | CODE + §5 | UI on `/api/household`; hide writes for viewer; 409 on owner delete until transfer → Test: owner invites viewer by email; viewer sees no edit controls. |
| P1-14 | **Connected goals are server-only** (`trackingMode`, `linkedCategory`, `goalTrackingService`) — spec §11 marks it done. | J8 | `server/models/Goal.js:54-55`; 0 hits in `client/src` | CODE | Goal form: link category/account, show forecast → Test: linked goal updates after a categorized transaction. |

### P2 — material friction / correctness risk

| ID | Finding | Job | Evidence | Verified | Fix → Test |
|----|---------|-----|----------|----------|------------|
| P2-1 | New user has **zero categories**; add form offers only "קטגוריה חדשה"; imports land in "כללי". | J1, J3 | browser `/portfolio` → עסקה חדשה; no seed in `server/` | LIVE | Seed a default Hebrew category set on household creation → Test: new user GET /categories ≥ 10. |
| P2-2 | **Navigation**: 6 core links + 25 in a 10 px "כלים נוספים" grid; Connections hidden there; `/alerts`, `/reports` have no nav entry; `/portfolio` = transactions while `/assets` = portfolio. Spec §6.1 calls for ~10 task areas. | all | `client/src/components/Navbar.jsx:23-82,821-866` | LIVE | Regroup nav to spec §6.1; Connections + Alerts first-class with unread badge → Test: every routed page reachable within 2 clicks; tree test with 3 tasks. |
| P2-3 | Identical same-day purchases silently dropped (unique index lacks `identifier`; E11000 swallowed). | J4 | `transactionPersistence.js:132-147` | CODE | Dedupe on `identifier` when present; index migration → Test: two identical coffees with different identifiers → 2 rows. |
| P2-4 | Timezone: month boundaries server-local (no `TZ`), client browser-local, dedupe UTC day. | J5 | `budgetCycleService.js:20-21`; `transactionPersistence.js:58-63` | REVIEW | Compute in `Asia/Jerusalem` → Test: purchase 00:30 IL on the 1st counts in that month. |
| P2-5 | Dismissed budget alerts recreated by the 6 h scheduler; thresholds not checked on transaction create/import (lag ≤ 6 h). | J5 | `notificationService.js:53-58`; callers of `checkBudgetThresholds` | CODE | Dedupe ignores `isDismissed` for period keys; check after import → Test: dismiss → scheduler tick → no new alert. |
| P2-6 | Sync not single-flight (double-click / manual + scheduled → parallel bank logins; orphaned `running` jobs). | J4 | `bankConnectionController.js:142-149`; `importRunner.js:72-76` | REVIEW | Atomic claim, 409 if in flight, stale-job sweep → Test: two concurrent sync calls → one job. |
| P2-7 | **Raw user input as Mongo `$regex`** (search, analytics, alerts). | J3 | `transactionController.js:55-56`; `analyticsController.js:158`; `alertController.js:202` | **LIVE**: search `(` → 500 "שגיאת שרת בחיפוש"; `.*` → all 335 rows | Escape input (helper exists at `businessRoutes.js:140`), `maxTimeMS` → Test: `(` and `(a+)+$` return literal matches fast. |
| P2-8 | Logout doesn't bump `tokenVersion`; refresh not rotated; "התנתק מכל המכשירים" only clears this browser. | J2 | `authController.js:183-193` | CODE | Bump on logout/logout-all; rotate refresh → Test: old refresh cookie after logout = 403. |
| P2-9 | Logging/privacy: public `/api/logs/device-ping` caches bodies in an unbounded Map; geo-IP over plain HTTP; Cal controller logs card last-4 + raw transactions. | — | `logsController.js:22`; `loggingMiddleware.js:79`; `calController.js:94-100` | REVIEW | Cap size, HTTPS or drop geo, remove debug logs. |
| P2-10 | Plan gating cosmetic: `requireFeature` unmounted; self-upgrade stub advertises "AI insights" that don't exist. | J10 | `middlewares/planGate.js`; `subscriptionController.js:36-54` | CODE | **Business decision:** hide upgrade until billing exists. |
| P2-11 | Performance: one 1.92 MB bundle on login; `GET /api/transactions` without params returns full history. | all | build output | **LIVE**: 335 rows / 133 KB in one response | `React.lazy` per route; default page size → Test: initial JS < 500 KB gzip; list paginated. |
| P2-12 | No client tests, lint broken, no CI. | — | `client/package.json` | LIVE | ESLint config, client Vitest, GitHub Actions (tests + build + lint + gitleaks + `npm audit --audit-level=critical`). |
| P2-13 | Dashboard onboarding / "סנכרן עכשיו" go to `/import/auto` (one-time, nothing saved) instead of `/connections`; onboarding endpoint never called. | J1 | `FinanceDashboard.jsx:118,283` | CODE | Point to `/connections`; minimal 3-step onboarding → Test: new user reaches saved connection in ≤ 3 clicks. |
| P2-14 | Controls that look functional but aren't: settings side-menu items are inert; "מחק את כל העסקאות" presented as final but is soft-delete of own rows only; "שדרג" self-upgrades free. | J9, J10 | `SettingsPage.jsx:114-116`; `transactionController.js:418`; `PlanSection` | CODE | Wire or remove; honest copy. |
| P2-15 | Suggestions board shared across customers, exposes `userName`, not scrubbed on deletion. | J12 | `suggestionController.js:14` | REVIEW | Show own suggestions only; anonymize on delete. |
| P2-16 | Household categorization inconsistent (`bulkUpdateMerchant` only `{user}`); no "awaiting categorization" queue; Help documents a button that lives in an orphaned page. | J3 | `transactionController.js:460`; `Transaction.js:41`; `HelpPage.jsx:238,268` | CODE | Scope by household; uncategorized filter + count on dashboard. |
| P2-17 | Disconnecting a bank only soft-deletes; encrypted credentials stay (spec §10.3 requires removal); no consent recorded. | J4, J9 | `bankConnectionController.js:125` | CODE | `$unset` credentials on disconnect; store `consentAt` → Test: after DELETE, no `credentials` field. |
| P2-18 | Dependency vulnerabilities (see §2): 3 critical, 42 high; direct fixes available for express, mongoose, axios, multer, jspdf. | — | `npm audit` | LIVE | `npm audit fix` (non-breaking) + review `xlsx` replacement → Test: CI audit gate. |

### P3 — polish / hygiene

- Dead code: 8 unrouted pages (`CalDirectImportPage`, `DashboardPage`, `DataEntryPage`, `DiscountImportPage`, `FinancePortfolioPage`, `HomePage`, `MaxImportPage` → calls unmounted `/api/max`, `SmartAnalyticsDashboard`); unused `server/check_users.js` (prints users incl. hashes/2FA secrets), `middlewares/requireAdmin.js`, `requireRefresh.js`, `utils/encryption.js`, `utils/googleSheets.js`, `routes/orders.js`/`orderRoutes.js`; dead sidebars in `Navbar.jsx`; root `gooZip.py`, `net.py`, `skriptName.py`, `vc.html`, `directory_structure.txt`.
- `/connections` header squeezed into a narrow column at 1024 px (LIVE); mobile 375 px `/portfolio` third header action clipped (LIVE).
- Validation errors returned as 500 (e.g. goal without `category` → 500 instead of 400) (LIVE).
- CORS always allows `localhost:5173/3000` with credentials, including production (`app.js:86-87`).
- Login reveals whether an email exists; verification email interpolates unescaped `user.name`; no minimum password length.
- Transactions store category **by name** — renaming a category orphans history.
- Sync failure messages shown raw in English (`importRunner.js:131`).

## 5. UX walkthrough (browser, seeded data)

Run by `pq-ux-reviewer` in the built-in browser against the seeded household (owner / partner / viewer),
desktop + mobile 375 px, dark-mode contrast measured in the DOM. Every P1 below was re-checked in code by
the main auditor (CODE ✔). Test edits left in the local in-memory DB only.

**Per-journey verdict:** Daily dashboard ↔ transactions — **Broken** (wrong month on dashboard) · Monthly
budget/alerts — Friction · Categorization — Works for owner, **Broken** for partner · Assets/loans/goals —
**Broken** (loans crash) · Household — **Broken/incomplete** · Settings — Friction · Keyboard/validation — Friction.

| ID | Sev | Finding | Job | Evidence | Fix → Test |
|----|-----|---------|-----|----------|------------|
| UX-1 | P1 | **`/my-loans` and `/loans/:id` white-screen the whole app.** List endpoint never returns `amortizationSchedule` (schema field commented out) but the card calls `.filter` on it → every loan crashes the list. Detail crashes on `primeRateOnStart` when no prime rate history exists. No error boundary, so the shell dies too. After creating a loan the form navigates to `/dashboard`. | J7 | browser console `LoanSummaryCard.jsx:24`, `LoanDetailPage.jsx:106`; CODE ✔ `loanController.js:27-35` vs `:47`, `models/Loan.js:42`, `NewLoanPage.jsx:34` | Compute/return schedule (or `?? []`), guard rate fields, route-level ErrorBoundary with Hebrew copy → Test: a loan created via the form renders in list + detail. |
| UX-2 | P1 | **Dashboard "הוצאות החודש" shows the previous month; "חודש קודם" ≈ ₪0.** Month key built with `toISOString()` from a *local*-midnight date, while Mongo groups by UTC `$dateToString` → on any non-UTC server (incl. local dev in Israel) "current" = last month. Top-categories list beside it uses the right month → same screen contradicts itself. (Related to P2-4.) | J5, daily | browser: dashboard ₪21,658 = exact September sum; `/portfolio` and `/budget` show October; CODE ✔ `server/controllers/dashboardController.js:34-35,52` | Use `$dateToString` with `timezone:'Asia/Jerusalem'` + date-range comparisons → Test: dashboard month totals equal `/portfolio` KPIs; previous month non-zero. |
| UX-3 | P1 | **Dashboard budget widget says "לא הוגדרו יעדי תקציב" while a budget exists** — reads `budget.categories[].actual`, API returns `budget.items[].spent`. | J5 | CODE ✔ `client/src/pages/FinanceDashboard.jsx:394-408` | Align to API → Test: 4 seeded budget bars render. |
| UX-4 | P1 | **Wrong password shows "Forbidden. Please log in again."** Interceptor tries `/auth/refresh` on the login 401 and surfaces the refresh 403. | J2 | browser; CODE ✔ `client/src/utils/api.js:146` (skips only `/auth/refresh`) | Skip refresh for `/auth/login`, `/auth/register`, `/auth/2fa/*`; show "אימייל או סיסמה שגויים" → Test: wrong password → correct Hebrew message. |
| UX-5 | P1 | **Partner/viewer have zero categories → partner cannot categorize or add a transaction** (category is required). Categories are per-user while transactions/budgets are household-scoped. | J3, J6 | browser: partner `GET /api/categories` → `[]`; CODE ✔ `categoryController.js:58` (`{ user: req.user._id }`) | Scope categories with `scopeFilter` (and rules — ties to P1-1) → Test: partner sees owner's 10 categories. |
| UX-6 | P1 | **Viewer sees every write control**; a blocked delete gets 403 with a good server message that the client discards for `alert('שגיאה במחיקת העסקה')`. | J6 | browser as viewer; `Transactions_tab.jsx:208-212` | Expose `member.role`, hide/disable writes with tooltip; toast `err.response.data.message`. (Extends P1-13.) |
| UX-7 | P1 | **`/family` can't manage roles/members**; owner can't see roles; viewer can copy the join code (→ partner access, P0-4); owner "עזוב" says "transfer ownership first" but no transfer UI exists — dead end. | J6 | browser; `client/src/pages/FamilyPage.jsx` | See P1-13. |
| UX-8 | P1 | **Add-transaction drawer isn't a modal for keyboard users**: no focus move/trap, Tab walks the page behind, Esc does nothing, close button unnamed, labels not bound to inputs, missing category → native `alert`. | J3 | browser keyboard pass; `Transactions_tab.jsx:488-517`, `AddTransactionForm.jsx:44` | Use the existing Dialog/Sheet primitive; inline field errors → Test: open → focus in first field, Esc closes, focus returns. |
| UX-9 | P1 | **On touch, row edit/delete are invisible** (`opacity-0 group-hover:opacity-100`) — computed opacity 0 at 375 px; tap opens merchant dialog only. Spec §6.3 says mobile-first for categorization. | J3 | browser mobile DOM check | Always visible on touch or overflow menu / swipe. |
| UX-10 | P2 | Large amounts lose minus sign and leading digits in KPI cards ("...225,357" for −1,225,357); no `title`. | daily | browser 1024 px, element 106 px vs text 122 px | Fit/compact format (₪1.2M) + `title`. |
| UX-11 | P2 | Changing a merchant's category immediately rewrites all history (28 rows / 6 months via `merchant-bulk`); the banner then reads as if nothing happened yet; no undo, no "only this one". | J3 | browser network | Ask scope first (this / all / future), undo toast. |
| UX-12 | P2 | Alerts go stale after edits (budget shows 164 %, `/alerts` still 98 %); superseded threshold alerts not resolved; dashboard repeats stale totals. | J5 | browser | Re-evaluate on transaction edit; resolve superseded alerts (ties to P1-12, P2-5). |
| UX-13 | P2 | Delete uses native `confirm('למחוק את העסקה?')` without merchant/amount; no undo. | J3 | `TransactionCard.jsx:35` | Existing dialog + undo toast. |
| UX-14 | P2 | Validation: ₪0 accepted; negative silently stored as absolute; inline-edit category is free text (typos create categories). | J3 | browser network | `min>0` server+client; category picker in inline edit. |
| UX-15 | P2 | Destructive copy wrong in Settings ("ייחסכו לצמיתות" → "יימחקו"; "מונגשת" → "מתבצעת אנונימיזציה"); delete-all has no count/household impact/typed confirm; notification switches disabled but shown ON; Free plan says "עד 2 בני משפחה" while household has 3 (limit not enforced). | J9 | browser | Fix copy; typed confirmation with count. |
| UX-16 | P2 | Dark mode: dashboard alert headline white-on-white (contrast 1.0); app ignores OS preference. | daily | DOM contrast measurement; `FinanceDashboard.jsx:97` | `dark:` variant; respect `prefers-color-scheme` by default. |
| UX-17 | P2 | Transactions at scale: no month/category filter; type filter applies only to loaded pages; filter chips and `/categories` rows are non-focusable `div`s; month nav buttons unlabeled. | J3 | browser keyboard pass | Server-side filters; real buttons with labels. |
| UX-18 | P2 | `/categories` compares month-to-date with the full previous month → almost everything shows a false "decrease". | J3 | browser on the 13th | Like-for-like days or label "חודש חלקי". |
| UX-19 | P2 | Dashboard "דו״ח מלא" → `/smart-analytics` → redirects back to dashboard (dead link); over-budget category shows "נותר ₪0" instead of overage; "העתק מחודש קודם" offered when nothing exists. | J5 | browser | Fix link to `/reports`; show overage; hide copy when no source. |
| UX-20 | P3 | Verify-email nag on `/login` from stale `localStorage.user`; login Tab order email → "שכחת סיסמה?" → password; show-password unlabeled; goal card says "מפגר" with no deadline; health score "out of 105"; "1 עסקאות"; dialog close labeled "Close" in English. | various | browser | Polish batch. |

## 6. Repair roadmap (ordered by dependency and regression risk)

Effort is not estimated here: no team velocity data exists, so any number would be a guess.

1. **Security stabilization** — P0-1, P0-2, P0-4, P1-7, P2-7, with the P1-9 isolation + viewer test matrices written first (they must fail before the fix). Owner actions in parallel: P0-3 key revocation / password rotation / history purge. Small, isolated server changes; low regression risk.
2. **Core-loop data integrity** — P1-2, P1-3, P1-4, P1-1 (needs a data migration → backup `corse` first), P2-3, P2-6. Each ships with a persistence/runner test.
3. **Account lifecycle** — P1-11 first (reset/verification/invites depend on it), then P1-8, P1-5, P1-6, P2-8, P2-17.
4. **Make the loop visible and honest** — UX-1 (loans crash) and UX-2/UX-3/UX-4 first (wrong numbers / wrong messages on the main screens, small client/server fixes), then P1-10, P1-12, P1-14, UX-5, UX-8, UX-9, P2-1, P2-2, P2-13, P2-14, remaining UX-10…UX-19.
5. **Household collaboration** — P1-13, UX-6, UX-7, P2-16.
6. **Engineering hygiene** — P2-11, P2-12, P2-18, P3.

## 7. Not verified

- Real bank scraping (needs real credentials); MAX remains broken per `known-unknowns.md`.
- Email delivery (no transport exists — P1-11).
- Sync concurrency (P2-6), Google login (P1-5): code-level only, not reproduced. Timezone: reproduced on the dashboard (UX-2) on an Israel-time host; budget/dedupe boundaries (P2-4) code-level only.
- UX not covered: bank connection/sync screens, export download, 2FA login challenge in UI, completed account deletion, real screen reader, partner's `/family` + settings views, viewer writes on budget/goals/loans, concurrent edits by two members.
- Loan / mortgage / tax math correctness and the Excel parser on real bank files.
- Production infra (reverse proxy, Atlas network rules) and git history beyond the tracked key file.

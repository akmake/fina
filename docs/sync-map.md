> Last updated: 2026-10-25

# Sync Map — Change Coupling Guide

> Before making any change, find the modified file below and check **all coupled files** in its row.
> This prevents silent breakage from coupling that is not obvious from the code alone.

---

## Server Changes

| If you change... | You must also check... |
|-----------------|----------------------|
| `server/app.js` | `docs/architecture.md` (middleware stack), `docs/auth-flow.md` (if middleware order changes) |
| `server/middlewares/authMiddleware.js` | `docs/auth-flow.md`, `client/src/utils/api.js` (interceptor), all route files that call `requireAuth` |
| `server/middlewares/csrf.js` | `docs/auth-flow.md`, `client/src/utils/api.js` (must send matching header) |
| `server/middlewares/rateLimiter.js` | `docs/architecture.md`, `docs/auth-flow.md` (rate-limited public routes) |
| `server/config/db.js` | `docs/database.md`, `server/.env` (`MONGO_URI`) |
| `server/models/User.js` | `server/controllers/authController.js`, `server/middlewares/authMiddleware.js`, `client/src/stores/authStore.js`, `docs/database.md` |
| `server/models/Transaction.js` | `server/controllers/transactionController.js`, `server/routes/transactionRoutes.js`, `docs/database.md`, `docs/modules/transactions.md` |
| `server/models/Category.js` | `server/models/Transaction.js` (category ref), `server/models/CategoryRule.js`, `server/models/Budget.js`, `docs/database.md` |
| `server/models/Loan.js` | `server/controllers/loanController.js`, loan amortization logic, `docs/modules/loans.md`, `docs/database.md` |
| `server/models/Stock.js` / `Fund.js` / `Deposit.js` / `Pension.js` | `client/src/stores/stockStore.js` etc., net worth calculation logic, `docs/modules/investments.md` |
| `server/models/NetWorthSnapshot.js` | Net worth page, dashboard summary, analytics endpoint |
| Any `server/models/*.js` | `docs/database.md` — add/update the schema table |
| Any `server/routes/*.js` | `docs/api-reference.md` — update the route table |
| Any new route file | `server/app.js` (must be mounted), `docs/api-reference.md` |
| `server/utils/` (any helper) | All controllers that import it |
| `server/middlewares/familyScope.js` | `server/utils/ensureHousehold.js`, `server/utils/scopeFilter.js`, every router mounted with `familyScope` in `app.js`, `docs/auth-flow.md`, `CLAUDE.md` |
| `server/models/Household.js` / `HouseholdMember.js` | `server/controllers/householdController.js`, `server/controllers/familyController.js` (shim), `server/utils/ensureHousehold.js`, `server/scripts/migrateToHouseholds.js`, `docs/database.md` |
| Household roles / permissions | `server/middlewares/requireHouseholdRole.js`, `familyScope` viewer-write block, `docs/product-spec-v2.md` (§8 matrix), `docs/api-reference.md` |

---

## Client Changes

| If you change... | You must also check... |
|-----------------|----------------------|
| `client/src/utils/api.js` | `docs/auth-flow.md` (interceptor behavior), all stores and pages that use `api` |
| `client/src/App.jsx` | `docs/auth-flow.md` (ProtectedRoute coverage), `client/src/components/ProtectedRoute.jsx` |
| `client/src/components/ProtectedRoute.jsx` | `client/src/stores/authStore.js`, `client/src/App.jsx`, `docs/auth-flow.md` |
| `client/src/stores/authStore.js` | `client/src/utils/api.js`, `client/src/components/ProtectedRoute.jsx`, `client/src/components/Navbar.jsx`, `docs/state-management.md` |
| `client/src/stores/projectsStore.js` | `client/src/utils/projects.js`, Projects page, Goals page, `docs/state-management.md` |
| `client/src/stores/electricalStore.js` | `client/src/utils/electricalEngine.js`, all Electrical components, `docs/modules/electrical.md` |
| `client/src/stores/depositsStore.js` / `fundStore.js` / `stockStore.js` | Net worth page, Investment portfolio page, `docs/state-management.md` |
| `client/src/utils/electricalEngine.js` | `client/src/stores/electricalStore.js`, all electrical components |
| `client/src/utils/pergolaEngine.js` | All pergola components, Pergola page |
| `client/src/utils/formatters.js` | Every component that displays formatted data (currency, dates, percentages) |
| `client/vite.config.js` | Proxy settings affect all API calls in dev, PWA config affects service worker |
| `client/.env` | `docs/architecture.md` env vars table |

---

## Cross-Cutting Changes

| If you change... | You must also check... |
|-----------------|----------------------|
| **Any env variable** (add/rename/remove) | `docs/architecture.md` env table, `.env.example` files (both client and server), deployment config |
| **Auth cookie name or format** | `server/middlewares/authMiddleware.js`, `server/middlewares/requireRefresh.js`, `client/src/utils/api.js` (interceptor), `docs/auth-flow.md` |
| **CSRF header name** (`X-Fina-Client`) | `server/middlewares/csrf.js`, `client/src/utils/api.js`, `docs/auth-flow.md` |
| **MongoDB model field names** | All controllers for that model, any client components that display/edit that field, `docs/database.md` |
| **API response envelope shape** | All client files that consume that endpoint |
| **Port numbers** | `client/vite.config.js` (proxy target), `server/.env`, `client/.env` (`VITE_API_URL`), `docs/architecture.md` |
| **New module / feature** | `docs/README.md`, `docs/api-reference.md`, `docs/database.md`, new `docs/modules/<name>.md` |

---

## Bank Scraper Coupling

| If you change... | You must also check... |
|-----------------|----------------------|
| `server/routes/scraperRoutes.js` | `server/routes/calRoutes.js` (parallel scraper), `docs/modules/bank-scraper.md`, `client/src/pages/` scraper pages |
| Scraper response format | Transaction import logic, auto-categorization, `MerchantMap` model |
| `server/models/MerchantMap.js` | Auto-categorization in `CategoryRule` processing |
| `server/services/scrapeService.js` (COMPANY_CONFIG, scrape core) | `server/controllers/scraperController.js`, `server/services/importRunner.js`, `docs/modules/bank-scraper.md`, `docs/modules/import.md` |
| `server/services/transactionPersistence.js` | `server/controllers/importController.js`, `server/services/importRunner.js` (both persist via it) |
| `server/services/fxService.js` / foreign-amount logic in `server/utils/excelParser.js` | `server/services/scrapeService.js` + `server/services/calService.js` (`_chargedCurrency` row field), `server/models/Transaction.js` (`amountEstimated`/`fxRate`), `client/src/components/transactions/TransactionCard.jsx`, `docs/modules/import.md` § Foreign-currency deals |
| `server/models/BankConnection.js` / `ImportJob.js` | `server/controllers/bankConnectionController.js`, `server/services/importRunner.js`, `server/services/importScheduler.js`, `docs/database.md`, `docs/modules/import.md` |
| `server/utils/crypto.js` | `server/models/BankConnection.js`, `server/services/importRunner.js`, `server/server.js` (env check), `docs/architecture.md` (env table) |
| `server/services/importRunner.js` / `importScheduler.js` | `server/controllers/bankConnectionController.js`, `server/controllers/deviceController.js` (submitJobOtp), `server/server.js` (scheduler start), `client/src/stores/connectionsStore.js` (job polling), `client/src/components/dashboard/UpdatesBrief.jsx` (job states), `docs/modules/import.md` |
| `server/services/calService.js` | `server/controllers/calController.js` (one-time import), `server/services/importRunner.js` (`calAuto`), `docs/modules/import.md` |
| `server/models/Device.js` / `middlewares/deviceAuth.js` / `routes/deviceRoutes.js` | `server/controllers/deviceController.js`, `client/src/pages/BankConnectionsPage.jsx` (pairing panel), the Android app (separate repo — contract in `docs/modules/import.md` § Phone OTP relay), `docs/auth-flow.md` |
| `server/controllers/aiController.js` / `routes/aiRoutes.js` / `middlewares/apiKeyAuth.js` / `models/ApiKey.js` | `server/services/categorizationService.js`, `mcp/index.js` + `mcp/client.js` (tool schemas mirror the API params), `client/src/components/settings/AiAccessSection.jsx`, `docs/modules/ai-mcp.md`, `mcp/README.md` |
| `server/controllers/oauthController.js` / `routes/oauthRoutes.js` / `models/OAuthClient.js` / `models/OAuthCode.js` | `server/middlewares/apiKeyAuth.js` (expiry + `WWW-Authenticate`), `server/app.js` (mount order vs CSRF), `client/src/pages/OAuthConsentPage.jsx`, `client/src/components/settings/AiAccessSection.jsx`, nginx `/.well-known` rule, `docs/modules/ai-mcp.md` § OAuth |
| `server/controllers/deviceController.js` (`relaySmsInbound`, `heartbeat`, `CAL_SMS`) / `/api/devices/sms` + `/heartbeat` mounting in `server/app.js` | The Relay SMS app in **`GitHub/AppSms`**: `relay/SmsFilter.kt` (same CAL pattern), `relay/RelayPolicy.kt` + `RelayClient.kt` (status-code handling — 425/401/429), `relay/RelayPipeline.kt`; `docs/modules/import.md` § Phone OTP relay |
| `server/controllers/updatesController.js` (`/api/dashboard/updates`) | `client/src/components/dashboard/UpdatesBrief.jsx`, `server/models/User.js` (`dashboardVisitAt`), `docs/api-reference.md` |
| `User.approvalStatus` / access approval | `server/controllers/authController.js` (`approvalBlock` — register/login/google/refresh/2fa), `server/middlewares/deviceAuth.js`, `server/services/importScheduler.js` (owner filter), `server/controllers/admin/userAdminController.js`, `client/src/pages/LoginPage.jsx`/`RegisterPage.jsx`/`AdminUsersPage.jsx`, `server/tests/helpers.js` (`registerApproved`) |
| `client/src/stores/connectionsStore.js` | `client/src/pages/BankConnectionsPage.jsx`, `docs/state-management.md`, `docs/modules/import.md` |

---

## SaaS Shell Coupling (Phase 4)

| If you change... | You must also check... |
|-----------------|----------------------|
| `server/controllers/authController.js` (register/login/2FA/verify) | `server/routes/auth.js`, `client/src/pages/LoginPage.jsx` (2FA step), `client/src/stores/authStore.js` (`emailVerified`/`twoFactorEnabled`), `docs/auth-flow.md`, `docs/api-reference.md` |
| `server/services/verificationService.js` | `server/services/emailService.js`, `server/models/User.js`, `client/src/pages/VerifyEmailPage.jsx`, `client/src/components/VerifyEmailBanner.jsx` |
| `server/services/twoFactorService.js` | `authController` (2FA handlers), `client/src/components/settings/TwoFactorSection.jsx`, `otplib` version (v12 classic API — not v13) |
| `server/services/accountService.js` | `server/controllers/accountController.js`, every owned business model listed in `OWNED_COLLECTIONS`, `docs/modules/saas-shell.md` |
| `server/models/Subscription.js` / `services/subscriptionService.js` | `server/controllers/subscriptionController.js`, `server/middlewares/planGate.js`, `client/src/components/settings/PlanSection.jsx`, `docs/database.md`, `docs/product-spec-v2.md` (§ pricing Q1) |
| `server/middlewares/planGate.js` | Any route it gates (currently none live — ready to attach), `services/subscriptionService.js` (PLANS) |

---

## Electrical CAD Coupling

| If you change... | You must also check... |
|-----------------|----------------------|
| `server/models/ElectricalProject.js` (canvas schema) | `client/src/utils/electricalEngine.js`, `client/src/stores/electricalStore.js`, all electrical components |
| `client/src/utils/electricalEngine.js` | Canvas save/load logic, component pricing, `electricalStore.js` |
| Fabric.js version | Canvas JSON format compatibility (breaking change risk) |

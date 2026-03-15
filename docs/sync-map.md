> Last updated: 2026-03-12

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

---

## Electrical CAD Coupling

| If you change... | You must also check... |
|-----------------|----------------------|
| `server/models/ElectricalProject.js` (canvas schema) | `client/src/utils/electricalEngine.js`, `client/src/stores/electricalStore.js`, all electrical components |
| `client/src/utils/electricalEngine.js` | Canvas save/load logic, component pricing, `electricalStore.js` |
| Fabric.js version | Canvas JSON format compatibility (breaking change risk) |

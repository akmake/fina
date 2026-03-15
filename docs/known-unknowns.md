> Last updated: 2026-03-12

# Known Unknowns

Open questions discovered during the project scan.
Purpose: prevent future AI sessions from re-investigating the same questions.
When an item is resolved, update its status and move findings to the canonical doc.

---

## Open Questions

| Item | Location | Status |
|------|----------|--------|
| `server/stores/authStore.js` purpose | `server/stores/authStore.js` | unknown — may be legacy/unused; client uses `authStore.js` in Zustand |
| `Investment.js` model role | `server/models/Investment.js` | unknown — separate from Stock, Fund, Deposit, Pension; unclear what it tracks |
| `DataRecordModel.js` schema and data types | `server/models/DataRecordModel.js` | unknown — flexible schema; no clear consumer identified |
| `/api/management` routes and purpose | `server/routes/managementRoutes.js` | unknown — route exists but operations unclear |
| `server/config/routes.js` vs `app.js` | `server/config/routes.js`, `server/app.js` | unknown — config/routes.js may be legacy; app.js appears to be canonical |
| `server/config/middlewares.js` vs `app.js` | `server/config/middlewares.js`, `server/app.js` | unknown — possible legacy split; app.js registers middleware directly |
| XLSX import expected column format | `server/routes/importRoutes.js` | unknown — no schema or sample found |
| AI suggestions source | `server/models/Suggestion.js`, `server/routes/suggestionRoutes.js` | unknown — described as "AI-generated" but no AI API integration found |
| React Query `QueryClient` config | `client/src/main.jsx` | unknown — staleTime, cacheTime, retry config not confirmed |
| Israeli mortgage tracks (מסלולים) modeling | `server/models/Mortgage.js` | unknown — multi-track mortgages not explicitly modeled |
| Electrical project export format | `client/src/components/electrical/`, `client/src/utils/electricalEngine.js` | unknown — export functionality unclear |
| Pergola planner save/persistence | `client/src/utils/pergolaEngine.js` | unknown — no dedicated model found; may be client-only state |
| `bcryptjs` presence alongside `bcrypt` | `server/package.json` | unknown — both listed; `bcrypt` is used but `bcryptjs` may be unused or a fallback |
| Rate limiting configuration (thresholds) | `server/middlewares/rateLimiter.js` | unknown — exact request limits not confirmed during scan |
| Console/error logging in production | `server/middlewares/errorHandler.js` | unknown — error verbosity in production not confirmed |
| `docker-compose.yml` current state | `docker-compose.yml` (root) | unknown — Docker setup present but not validated; may be incomplete |
| `python/` directory purpose | `python/` (root) | unknown — Python scripts present; relationship to main app unclear |
| `gooZip.py`, `net.py`, `skriptName.py` | root directory | unknown — standalone scripts; purpose unclear, may be unrelated utilities |
| `vc.html` file | `vc.html` (root) | unknown — standalone HTML file; purpose unclear |
| `client/src/stores/accountStore.js` exact API route | `client/src/stores/accountStore.js` | unknown — route `/api/accounts` assumed but not confirmed in route files |
| Admin user creation process | `server/models/User.js` (`role` field) | unknown — no admin registration flow found; how first admin is created is unclear |

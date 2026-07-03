> Last updated: 2026-07-03

# Known Unknowns

Open questions discovered during the project scan.
Purpose: prevent future AI sessions from re-investigating the same questions.
When an item is resolved, update its status and move findings to the canonical doc.

---

## Open Questions

| Item | Location | Status |
|------|----------|--------|
| ~~`server/stores/authStore.js` purpose~~ | — | **resolved 2026-07** — was an unused client copy; deleted (along with `server/stores/projectsStore.js`) |
| `Investment.js` model role | `server/models/Investment.js` | unknown — separate from Stock, Fund, Deposit, Pension; unclear what it tracks |
| `DataRecordModel.js` schema and data types | `server/models/DataRecordModel.js` | unknown — flexible schema; no clear consumer identified |
| `/api/management` routes and purpose | `server/routes/managementRoutes.js` | unknown — route exists but operations unclear |
| ~~`server/config/routes.js` vs `app.js`~~ | — | **resolved 2026-07** — legacy, unimported; deleted. `app.js` is canonical (entry point is now `server.js`) |
| ~~`server/config/middlewares.js` vs `app.js`~~ | — | **resolved 2026-07** — legacy, unimported; deleted |
| XLSX import expected column format | `server/routes/importRoutes.js` | unknown — no schema or sample found |
| AI suggestions source | `server/models/Suggestion.js`, `server/routes/suggestionRoutes.js` | unknown — described as "AI-generated" but no AI API integration found |
| React Query `QueryClient` config | `client/src/main.jsx` | unknown — staleTime, cacheTime, retry config not confirmed |
| Israeli mortgage tracks (מסלולים) modeling | `server/models/Mortgage.js` | unknown — multi-track mortgages not explicitly modeled |
| Electrical project export format | `client/src/components/electrical/`, `client/src/utils/electricalEngine.js` | unknown — export functionality unclear |
| Pergola planner save/persistence | `client/src/utils/pergolaEngine.js` | unknown — no dedicated model found; may be client-only state |
| ~~`bcryptjs` presence alongside `bcrypt`~~ | — | **resolved 2026-07** — unused; removed from dependencies |
| ~~Rate limiting configuration (thresholds)~~ | — | **resolved 2026-07** — documented in [architecture.md](architecture.md): public 100/10min, auth 20/15min, scrape 10/hour (prod only) |
| Console/error logging in production | `server/middlewares/errorHandler.js` | unknown — error verbosity in production not confirmed |
| **MAX (מקס) import broken** | `server/controllers/scraperController.js` (`/scrape` company `max`), `client/src/pages/MaxImportPage.jsx` | **investigated 2026-07-03** — MAX login fails every time regardless of credentials. (1) The puppeteer scraper via `/scrape` reaches `max.co.il/login` then **TIMEOUT** — reproduced with dummy creds; `israeli-bank-scrapers@6.7.9` (the latest published) has stale login/result selectors vs MAX's current OTP-based site, so it returns TIMEOUT instead of a clean `invalidPassword`. No upstream fix available. (2) `MaxImportPage` calls `/max/request-otp` + `/max/verify-otp` but **no maxController/maxRoutes exist and `/api/max` is not mounted** → 404. Real fix = build a MAX **direct-API OTP backend** (mirror `calController.js`), OR wait for the library to fix MAX. Also fixed here: partial-Chrome self-heal in `scripts/installChrome.mjs` + existence guard in `resolveExecutablePath` (a partial Chrome download made every scrape fail with "Browser was not found"). |
| `docker-compose.yml` current state | `docker-compose.yml` (root) | unknown — Docker setup present but not validated; may be incomplete |
| `python/` directory purpose | `python/` (root) | unknown — Python scripts present; relationship to main app unclear |
| `gooZip.py`, `net.py`, `skriptName.py` | root directory | unknown — standalone scripts; purpose unclear, may be unrelated utilities |
| `vc.html` file | `vc.html` (root) | unknown — standalone HTML file; purpose unclear |
| `client/src/stores/accountStore.js` exact API route | `client/src/stores/accountStore.js` | unknown — route `/api/accounts` assumed but not confirmed in route files |
| ~~Admin user creation process~~ | — | **resolved 2026-07** — first admin via `server/createAdmin.js` script only; register endpoint never accepts `role` from the body (privilege-escalation fix) |

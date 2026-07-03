# Android implementation audit

Audit date: 2026-07-03

## Evidence

- The web client currently contains 40 routed pages and 211 explicit API call sites.
- The Android client currently declares 34 API operations.
- A successful compilation proves type/resource integrity; it does not prove product parity.
- `Done` is forbidden until every web action and server field for that feature has a native equivalent and tests.

## Known gaps in implemented features

| Feature | Missing behavior |
|---|---|
| Authentication | Google Credential Manager sign-in |
| Dashboard | net worth, mortgages, goals, alerts, budgets, recommendations, analytics, reports, charts |
| Transactions | month cursor paging, merchant detail/bulk editing, Excel import wizard, category creation, maaser prompt |
| Categories | rule CRUD and applying rules |
| Budget | copy previous month and annual summary |
| Recurring | detection candidates and cash-flow forecast |
| Stocks | source-account selection and live FX handling inherited from server |
| Deposits | source-account selection and exit-point editor |
| Automatic import | Native flows exist for configured scrapers, CAL OTP and One Zero OTP; live-provider verification still requires test credentials and must not be marked Done before that evidence exists |

## Backend contract defects discovered

- The web profile called `PUT /api/auth/profile` and `PUT /api/auth/change-password`, but those routes did not exist.
- Both routes are now implemented with authentication, custom-header CSRF protection, validation, and tests.
- Calls to `/api/max/*` exist in the web client while no MAX router is mounted in `server/app.js`; this remains an explicit backend gap.

## Verification performed

- Android `:app:assembleDebug`: passing.
- Server test suite: 19/19 passing.
- Auth tests now cover profile security-header enforcement, profile update, current-password verification, and new-password login.

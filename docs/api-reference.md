> Last updated: 2026-07-03

# API Reference

Base URL: `http://localhost:4000/api` (dev) — configured via `VITE_API_URL` on the client.

All protected routes require:
- Valid `jwt` cookie (set at login)
- `X-Fina-Client: web-app` header (CSRF protection, added by Axios interceptor automatically)

---

## Public Routes (No Auth Required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check — returns `{ status: 'ok' }` |
| GET | `/csrf-token` | Returns CSRF token (rate limited) |
| POST | `/auth/register` | Register new user `{ name, email, password }` |
| POST | `/auth/login` | Login `{ email, password }` → sets JWT cookies |
| POST | `/auth/google` | Google OAuth `{ credential: id_token }` |
| POST | `/auth/logout` | Clears JWT cookies |
| POST | `/auth/refresh` | Refresh access token using refresh cookie |
| POST | `/logs/device-ping` | Device analytics ping (public by design — sent before login; rate limited) |

> `/auth/*` routes are rate limited (20 requests / 15 min in production) to block brute-force.

---

## Household / Tenancy Routes (Auth Required)

Canonical tenancy API. All routes run `resolveHousehold` first. Role guards use
the caller's `HouseholdMember.role` (owner/partner/viewer). Mutating routes need the CSRF header.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/household` | any | Active household + members |
| GET | `/household/mine` | any | All households the user is an active member of (for switching) |
| PUT | `/household/name` | owner/partner | Rename household |
| POST | `/household/invite` | owner | Invite by `{ email, role }` → returns invitation `token` |
| POST | `/household/accept` | any (auth) | Accept an invitation `{ token }` |
| POST | `/household/join-code` | any (auth) | Join by shareable `{ code }` as partner |
| POST | `/household/switch` | member | Switch active household `{ householdId }` |
| POST | `/household/leave` | any member | Leave current household (owner must transfer first) |
| PUT | `/household/members/:memberId/role` | owner | Change a member's role (keeps ≥1 owner) |
| DELETE | `/household/members/:memberId` | owner | Remove a member (soft, keeps their data) |

> Legacy `/family/*` (`GET /`, `POST /create`, `POST /join`, `POST /leave`, `PUT /name`)
> remains as a **compatibility shim** over Households for the existing client FamilyPage.
> Sensitive actions (invite, join, role change, remove, leave) write an `AuditLog` entry.

---

## Bank Import Routes (Auth Required + Scrape Rate Limit)

Since Phase 0 hardening these routes require a valid `jwt` cookie + CSRF header,
and are limited to 10 requests/hour in production (each request may launch a headless browser).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/scrape` | Bank scraping with user-provided credentials (rejects OTP-flow companies, e.g. One Zero) |
| GET | `/scrape/companies` | List supported banks (each entry includes `otpFlow` + required `fields`) |
| POST | `/scrape/onezero/otp/start` | One Zero — trigger SMS OTP (body: `phoneNumber`), returns `otpContext` |
| POST | `/scrape/onezero/otp/verify` | One Zero — verify code + scrape (body: `otpContext`, `otpCode`, `email`, `password`, `startDate?`, `incomesOnly?`); response includes `otpLongTermToken` |
| POST | `/cal/request-otp` | CAL direct import — request OTP |
| POST | `/cal/verify-otp` | CAL — verify OTP and fetch |
| POST | `/cal/verify-otp-import` | CAL — verify OTP and import |
| POST | `/cal/process-accounts` | CAL — process raw account payload |
| POST | `/import` | Excel/XLSX file import |

---

## Saved Bank Connections (Auth + familyScope) — Phase 2, Import 2.0

Encrypted, reusable bank/credit connections that sync **unattended** (daily
scheduler + on-demand). Credentials are AES-256-GCM at rest and are **never**
returned. Mounted at `/api/connections`. See [modules/import.md](modules/import.md).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/connections/companies` | Supported institutions + required credential fields (`visaCal` excluded client-side — browser-OTP, not reusable) |
| GET | `/connections` | List the household's connections (metadata only — no secrets) |
| POST | `/connections` | Create (body: `company`, `displayName?`, `autoSync?`, `incomesOnly?`, `otpLongTermToken?` for One Zero, `...credFields`). Credentials encrypted on write |
| PATCH | `/connections/:id` | Update `displayName`/`autoSync`/`incomesOnly`, or rotate credentials/token |
| DELETE | `/connections/:id` | Soft delete (audited) |
| POST | `/connections/:id/sync` | Trigger sync now → `202 { jobId }` (scrape rate-limited); poll the job |
| GET | `/connections/:id/jobs` | Recent sync history (last 20) for a connection |
| GET | `/connections/jobs/:id` | Poll a single ImportJob's status/stats |

---

## Auth Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register |
| POST | `/auth/login` | No | Login |
| POST | `/auth/google` | No | Google OAuth |
| POST | `/auth/logout` | Yes | Logout, clear cookies |
| POST | `/auth/refresh` | Refresh cookie | Get new access token |

---

## Finance Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/finance` | Yes | Get user's finance profile |
| POST | `/finance` | Yes | Create or update finance profile |

---

## Transactions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/transactions` | Yes | List transactions (pagination, filters) |
| POST | `/transactions` | Yes | Create transaction |
| PUT | `/transactions/:id` | Yes | Update transaction |
| DELETE | `/transactions/:id` | Yes | Delete transaction |
| GET | `/transactions/search` | Yes | Search transactions |

---

## Categories

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/categories` | Yes | List all categories |
| POST | `/categories` | Yes | Create category |
| DELETE | `/categories/:id` | Yes | Delete category |
| POST | `/categories/sync` | Yes | Backfill categories from transactions |
| GET | `/categories/rules/all` | Yes | List category rules |
| POST | `/categories/rules` | Yes | Create rule (body `applyToExisting` retro-categorizes; returns `appliedCount`) |
| POST | `/categories/rules/suggest` | Yes | **Phase 3** — suggest a rule from a txn/description (§5.3); returns `searchString`, `matchCount`, `ruleExists` |
| POST | `/categories/rules/apply` | Yes | Apply all rules to existing transactions |
| DELETE | `/categories/rules/:id` | Yes | Delete rule |

---

## Budget

Mounted at `/api/budgets` (`requireAuth` + `familyScope`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/budgets?month=&year=` | Yes | Get month budget + actual spending |
| GET | `/budgets/summary?year=` | Yes | Yearly budget summary |
| POST | `/budgets` | Yes | Create/update month budget |
| POST | `/budgets/copy` | Yes | Copy budget between months |
| POST | `/budgets/rollover` | Yes | **Phase 3** — roll a month forward, optional `carryOver` of unspent balance (§5.4) |
| POST | `/budgets/check-thresholds?month=&year=` | Yes | **Phase 3** — raise 75/90/100% budget notifications |
| DELETE | `/budgets/:id` | Yes | Soft-delete budget |

---

## Recurring Transactions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/recurring` | Yes | List recurring transactions |
| POST | `/recurring` | Yes | Create recurring |
| PUT | `/recurring/:id` | Yes | Update recurring |
| DELETE | `/recurring/:id` | Yes | Delete recurring |

---

## Net Worth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/net-worth` | Yes | Get net worth snapshots |
| POST | `/net-worth` | Yes | Create snapshot |

---

## Investments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/deposits` | Yes | List deposits |
| POST | `/deposits` | Yes | Create deposit |
| PUT | `/deposits/:id` | Yes | Update deposit |
| DELETE | `/deposits/:id` | Yes | Delete deposit |
| GET | `/funds` | Yes | List funds |
| POST | `/funds` | Yes | Create fund |
| PUT | `/funds/:id` | Yes | Update fund |
| DELETE | `/funds/:id` | Yes | Delete fund |
| GET | `/stocks` | Yes | List stocks |
| POST | `/stocks` | Yes | Create stock |
| PUT | `/stocks/:id` | Yes | Update stock |
| DELETE | `/stocks/:id` | Yes | Delete stock |
| GET | `/pension` | Yes | List pension accounts |
| POST | `/pension` | Yes | Create pension |
| PUT | `/pension/:id` | Yes | Update pension |
| DELETE | `/pension/:id` | Yes | Delete pension |
| GET | `/investments` | Yes | Investment portfolio overview |
| POST | `/investments` | Yes | Add investment |

---

## Loans & Debt

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/loans` | Yes | List loans |
| POST | `/loans` | Yes | Create loan (calculates amortization) |
| PUT | `/loans/:id` | Yes | Update loan |
| DELETE | `/loans/:id` | Yes | Delete loan |
| GET | `/loans/:id/amortization` | Yes | Get amortization schedule |
| GET | `/debts` | Yes | List debts |
| POST | `/debts` | Yes | Create debt |
| PUT | `/debts/:id` | Yes | Update debt |
| DELETE | `/debts/:id` | Yes | Delete debt |

---

## Projects & Goals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/projects` | Yes | List projects |
| POST | `/projects` | Yes | Create project |
| PUT | `/projects/:id` | Yes | Update project |
| DELETE | `/projects/:id` | Yes | Delete project |
| GET | `/goals` | Yes | List goals (refreshes connected goals first) |
| POST | `/goals` | Yes | Create goal |
| PUT | `/goals/:id` | Yes | Update goal |
| DELETE | `/goals/:id` | Yes | Soft-delete goal |
| POST | `/goals/:id/deposit` | Yes | Add a contribution to a goal |
| POST | `/goals/:id/recompute` | Yes | **Phase 3** — recompute a connected goal from its linked source (§5.6) |
| POST | `/goals/recompute-all` | Yes | **Phase 3** — recompute all connected goals |
| GET | `/child-savings` | Yes | List child savings |
| POST | `/child-savings` | Yes | Create child savings |
| PUT | `/child-savings/:id` | Yes | Update |
| DELETE | `/child-savings/:id` | Yes | Delete |

---

## Real Estate & Housing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/real-estate` | Yes | List properties |
| POST | `/real-estate` | Yes | Add property |
| PUT | `/real-estate/:id` | Yes | Update property |
| DELETE | `/real-estate/:id` | Yes | Delete property |
| GET | `/mortgage` | Yes | List mortgages |
| POST | `/mortgage` | Yes | Create mortgage |
| PUT | `/mortgage/:id` | Yes | Update mortgage |
| DELETE | `/mortgage/:id` | Yes | Delete mortgage |

---

## Insurance & Tax

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/insurance` | Yes | List insurance policies |
| POST | `/insurance` | Yes | Add insurance |
| PUT | `/insurance/:id` | Yes | Update insurance |
| DELETE | `/insurance/:id` | Yes | Delete insurance |
| GET | `/tax` | Yes | Tax planning data |
| POST | `/tax` | Yes | Save tax data |

---

## Analytics & Reporting

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/analytics` | Yes | Analytics data (charts, trends) |
| GET | `/dashboard` | Yes | Dashboard summary data |
| GET | `/reports` | Yes | Generate reports |

---

## Alerts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/alerts` | Yes | List alerts |
| POST | `/alerts` | Yes | Create alert |
| PUT | `/alerts/:id` | Yes | Update alert |
| DELETE | `/alerts/:id` | Yes | Delete alert |

---

## Misc

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/foreign-currency` | Yes | Foreign currency holdings |
| POST | `/foreign-currency` | Yes | Add currency holding |
| PUT | `/foreign-currency/:id` | Yes | Update |
| DELETE | `/foreign-currency/:id` | Yes | Delete |
| GET | `/rates` | Yes | Rate history |
| GET | `/suggestions` | Yes | AI-generated suggestions |
| GET/POST | `/data` | Yes | Generic data records |
| GET/POST | `/electrical` | Yes | Electrical CAD projects |

---

## Admin Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/logs` | Admin | View system logs |
| GET | `/admin/user-activity` | Admin | View user activity |

---

## Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| * | `/management` | Yes | Management operations (unknown — requires clarification) |

---

## Notes

- All responses use `{ success, data, message, error }` envelope pattern (inferred from controller pattern)
- Pagination: `?page=1&limit=20` on list endpoints
- Filters: varies by endpoint — `?startDate=`, `?endDate=`, `?category=`, `?type=`
- Error codes: 400 (validation), 401 (unauthenticated), 403 (CSRF / forbidden), 404 (not found), 500 (server error)

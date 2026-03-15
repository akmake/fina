> Last updated: 2026-03-12

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
| POST | `/import` | Import data (file upload, no auth) |
| POST | `/scrape` | Bank scraping with user-provided credentials |
| POST | `/cal` | Calendar / bank direct import |

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
| PUT | `/categories/:id` | Yes | Update category |
| DELETE | `/categories/:id` | Yes | Delete category |

---

## Budget

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/budget` | Yes | Get budgets |
| POST | `/budget` | Yes | Create budget |
| PUT | `/budget/:id` | Yes | Update budget |
| DELETE | `/budget/:id` | Yes | Delete budget |

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
| GET | `/goals` | Yes | List goals |
| POST | `/goals` | Yes | Create goal |
| PUT | `/goals/:id` | Yes | Update goal |
| DELETE | `/goals/:id` | Yes | Delete goal |
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

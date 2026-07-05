> Last updated: 2026-07-03

# Module: Bank Scraper

## Overview

Automated bank data import using the `israeli-bank-scrapers` npm package (v6.7.9).
Allows users to connect their Israeli bank accounts and automatically import transactions.
Since Phase 0 hardening (2026-07) these routes **require auth** (jwt cookie + CSRF header)
and are rate limited via `scrapeLimiter` (10/hour in production).

> **Refactor (Phase 2, 2026-07):** the scrape core — `COMPANY_CONFIG`, credential
> shaping, `runScrape`, and the One Zero OTP helpers — now lives in
> `server/services/scrapeService.js`. `scraperController.js` is a thin HTTP layer
> over it, and the **saved-connection** job runner reuses the same service for
> unattended sync. For the always-on daily import feature see
> [import.md](import.md). This one-time-import flow is unchanged.

## User Flow

```
Import page:
  ├── User provides bank credentials (username, password, card/ID number)
  ├── POST /api/scrape → israeli-bank-scrapers runs
  ├── Returns transactions array
  ├── User reviews → confirms import
  └── Transactions saved to DB with source: 'scraper'

Alternative (CAL bank direct):
  └── POST /api/cal → dedicated CAL bank import

One Zero (SMS OTP, two-step):
  ├── POST /api/scrape/onezero/otp/start  → sends SMS, returns otpContext
  ├── User enters the code from SMS
  └── POST /api/scrape/onezero/otp/verify → exchanges code for a long-term
      token, scrapes, and returns transactions (+ otpLongTermToken for reuse)

Excel import:
  └── POST /api/import → XLSX parsing → bulk transaction create
```

## Key Files

| File | Role |
|------|------|
| `server/routes/scraperRoutes.js` | Main scraper endpoint |
| `server/routes/calRoutes.js` | CAL bank dedicated import |
| `server/routes/importRoutes.js` | Excel/file import |
| `server/models/MerchantMap.js` | Maps raw merchant names → clean names |
| `server/models/CategoryRule.js` | Maps clean names → categories |
| `client/src/pages/` (scraper pages) | Import UI |

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/api/scrape/companies` | **JWT + CSRF + scrapeLimiter** | List companies + required fields + `otpFlow` flag |
| POST | `/api/scrape` | **JWT + CSRF + scrapeLimiter** | Bank scraping with user credentials (rejects `otpFlow` companies) |
| POST | `/api/scrape/onezero/otp/start` | **JWT + CSRF + scrapeLimiter** | One Zero — trigger SMS OTP |
| POST | `/api/scrape/onezero/otp/verify` | **JWT + CSRF + scrapeLimiter** | One Zero — verify code + scrape |
| POST | `/api/cal/*` | **JWT + CSRF + scrapeLimiter** | CAL bank direct import (OTP flow) |
| POST | `/api/import` | **JWT + CSRF + scrapeLimiter** | Excel/XLSX file import |

## Request Format (Scraper)

Credentials are sent **flat** (one key per field the company needs — the fields
come from `GET /scrape/companies`), not nested under a `credentials` object:

```json
{
  "company": "hapoalim",
  "userCode": "...",
  "password": "...",
  "startDate": "2024-01-01",
  "incomesOnly": true
}
```

Supported banks via `israeli-bank-scrapers`: Hapoalim, Leumi, Discount, Mercantile,
Mizrahi, Otsar Hahayal, Union, Beinleumi, Massad, Yahav, Beyahad Bishvilha,
Behatsdaa, Pagi, One Zero — plus credit cards Max, Visa Cal, Isracard, Amex.

### One Zero OTP (special case)

One Zero (`company: "oneZero"`, marked `otpFlow: true`) authenticates via SMS OTP,
so it is **not** importable through `POST /scrape`. Instead:

1. `POST /scrape/onezero/otp/start` with `{ phoneNumber }` (full international,
   must start with `+`) → sends the SMS, returns `{ otpContext }`.
2. `POST /scrape/onezero/otp/verify` with `{ otpContext, otpCode, email, password,
   startDate?, incomesOnly? }` → exchanges the code for a long-term token, scrapes,
   and returns the usual payload plus `otpLongTermToken` (for optional future reuse).

`otpContext` is the only state carried between the two requests — no scraper
instance is kept on the server between calls.

## Auto-Categorization Pipeline

```
Raw transaction from scraper
  → MerchantMap lookup (normalize merchant name)
  → CategoryRule matching (pattern match on description/merchant)
  → Category assigned automatically
  → If no match → category = null (user assigns manually)
```

## Schemas Used

See [docs/database.md](../database.md) for full schema reference.

| Model | Key fields used in this module |
|-------|-------------------------------|
| `Transaction` | `identifier` (dedup), `source`, `description`, `memo`, `amount`, `date` |
| `MerchantMap` | `originalName`, `cleanName`, `category` |
| `CategoryRule` | `pattern`, `category` |

## Coupling

| If you change... | Also update... |
|-----------------|----------------|
| `server/routes/scraperRoutes.js` | `server/controllers/scraperController.js`, `client/src/pages/AutoImportPage.jsx` (import UI + OTP flow), `docs/modules/bank-scraper.md`, `docs/api-reference.md` |
| `COMPANY_CONFIG` (supported banks/fields) | `server/tests/stubs/israeli-bank-scrapers.js` (stub `CompanyTypes` must include every `companyId` used), `client/src/pages/AutoImportPage.jsx` |
| Scraper response field names | `server/controllers/transactionController.js` (import mapping), `server/models/Transaction.js` |
| `server/models/MerchantMap.js` | Auto-categorization in `server/controllers/transactionController.js` |
| `server/routes/importRoutes.js` | XLSX column mapping logic, `docs/modules/bank-scraper.md` |
| `israeli-bank-scrapers` version | Test ALL supported banks — breaking changes are common between minor versions |

## Coupling Warnings (narrative)

- These routes require auth — the client is already inside `ProtectedRoute` and Axios sends the cookie + CSRF header automatically
- In tests, `israeli-bank-scrapers` is stubbed (`server/tests/stubs/israeli-bank-scrapers.js`) — the real package pulls puppeteer and breaks Vitest resolution
- The `identifier` field on `Transaction` is used for deduplication — scrapers return this from the bank
- Changing `MerchantMap` or `CategoryRule` schemas affects the categorization pipeline
- `israeli-bank-scrapers` library updates may break existing bank integrations — version-pin carefully

## Known Issues / Pitfalls

- User bank credentials are sent in request body (never stored in DB) — but they transit the network; HTTPS is mandatory in production
- Rate-limiting on scraper routes may be needed — banks may block automated access
- Bank websites change frequently — scraper package may break without warning
- No webhook/notification when scraper fails mid-import
- `XLSX` import assumes specific column structure — unknown exactly what format is expected (requires clarification)

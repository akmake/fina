> Last updated: 2026-03-12

# Module: Bank Scraper

## Overview

Automated bank data import using the `israeli-bank-scrapers` npm package.
Allows users to connect their Israeli bank accounts and automatically import transactions.
Since Phase 0 hardening (2026-07) these routes **require auth** (jwt cookie + CSRF header)
and are rate limited via `scrapeLimiter` (10/hour in production).

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
| POST | `/api/scrape` | **JWT + CSRF + scrapeLimiter** | Bank scraping with user credentials |
| POST | `/api/cal/*` | **JWT + CSRF + scrapeLimiter** | CAL bank direct import (OTP flow) |
| POST | `/api/import` | **JWT + CSRF + scrapeLimiter** | Excel/XLSX file import |

## Request Format (Scraper)

```json
{
  "bank": "hapoalim",
  "credentials": {
    "username": "...",
    "password": "...",
    "nationalId": "..."
  },
  "startDate": "2024-01-01"
}
```

Supported banks via `israeli-bank-scrapers`: Hapoalim, Leumi, Discount, Mizrahi, OneZero, Max, Visa Cal, Isracard, Amex, and others.

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
| `server/routes/scraperRoutes.js` | `server/routes/calRoutes.js` (parallel scraper), `docs/modules/bank-scraper.md`, `docs/api-reference.md` |
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

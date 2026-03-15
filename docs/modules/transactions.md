> Last updated: 2026-03-12

# Module: Transactions

## Overview

Core financial data. Transactions are created manually, via Excel import, or via bank scraper.
Auto-categorization rules (`CategoryRule`) map merchant names to categories automatically.

## User Flow

```
Transactions page:
  ├── View list (filters: date range, category, type, account)
  ├── Add manually → form → POST /api/transactions
  ├── Import from Excel → /api/import → bulk create
  ├── Import from bank → /api/scrape or /api/cal → bulk create
  └── Edit / Delete individual transactions

Auto-categorization:
  → On transaction create/import
  → Check CategoryRules (user-specific + defaults)
  → Match by merchant name / description pattern
  → Assign category automatically
```

## Key Files

| File | Role |
|------|------|
| `server/models/Transaction.js` | Main schema |
| `server/models/Category.js` | Category schema |
| `server/models/CategoryRule.js` | Auto-categorization rules |
| `server/models/RecurringTransaction.js` | Templates for recurring transactions |
| `server/models/MerchantMap.js` | Merchant name normalization |
| `server/routes/transactionRoutes.js` | Route definitions |
| `server/controllers/transactionController.js` | CRUD + search + import logic |
| `server/routes/categoryRoutes.js` | Category routes |
| `server/controllers/categoryController.js` | Category CRUD |
| `client/src/pages/TransactionsPage.jsx` | Main transactions UI |

## Schema: Transaction

```js
{
  user: ObjectId (ref: User),
  amount: Number,
  date: Date,
  description: String,
  category: ObjectId (ref: Category),
  type: String (enum: 'income' | 'expense' | 'transfer'),
  account: ObjectId (ref: Account),
  // Bank scraper fields:
  identifier: String,       // unique bank transaction ID
  processedDate: Date,      // bank processing date vs. transaction date
  memo: String,             // bank memo field
  originalCurrency: String,
  originalAmount: Number,
  // Import metadata:
  source: String (enum: 'manual' | 'import' | 'scraper'),
  createdAt: Date
}
```

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transactions` | Yes | List (pagination + filters) |
| POST | `/api/transactions` | Yes | Create |
| PUT | `/api/transactions/:id` | Yes | Update |
| DELETE | `/api/transactions/:id` | Yes | Delete |
| GET | `/api/transactions/search` | Yes | Full-text search |
| GET | `/api/categories` | Yes | List categories |
| POST | `/api/categories` | Yes | Create category |
| PUT | `/api/categories/:id` | Yes | Update category |
| DELETE | `/api/categories/:id` | Yes | Delete category |
| GET | `/api/recurring` | Yes | List recurring transactions |

## Schemas Used

See [docs/database.md](../database.md) for full schema reference.

| Model | Key fields used in this module |
|-------|-------------------------------|
| `Transaction` | `amount`, `date`, `description`, `category`, `type`, `account`, `identifier`, `source` |
| `Category` | `name`, `type`, `color`, `icon` |
| `CategoryRule` | `pattern`, `category`, `priority` |
| `Budget` | `category`, `amount`, `period` |
| `RecurringTransaction` | `amount`, `description`, `category`, `frequency`, `nextDate` |
| `MerchantMap` | `originalName`, `cleanName`, `category` |

## Coupling

| If you change... | Also update... |
|-----------------|----------------|
| `server/models/Transaction.js` | `server/controllers/transactionController.js`, `server/routes/transactionRoutes.js`, `docs/database.md`, `docs/modules/transactions.md` |
| `server/models/Category.js` | `server/models/Transaction.js` (category ref), `server/models/Budget.js`, `server/models/CategoryRule.js`, `docs/database.md` |
| `server/models/CategoryRule.js` | `server/controllers/transactionController.js` (auto-categorization logic), `server/models/MerchantMap.js` |
| `Transaction.identifier` field | `server/routes/scraperRoutes.js` (dedup logic), `server/routes/importRoutes.js` |
| `Transaction.description` or `Transaction.memo` | `server/models/CategoryRule.js` (pattern matching input), `docs/modules/bank-scraper.md` |
| `server/models/Budget.js` | Budget progress calculations in `server/controllers/` and dashboard endpoint |

## Coupling Warnings (narrative)

- `Transaction.category` references `Category._id` — deleting a category without re-categorizing orphans those transactions
- Bank scraper uses `identifier` field for deduplication — don't remove it
- `CategoryRule` processing depends on `Transaction.description` and `Transaction.memo` — changing these field names breaks auto-categorization
- `Budget` is checked against `Transaction.category` + `Transaction.date` — budget calculations break if category assignment is wrong

## Known Issues / Pitfalls

- Duplicate detection relies on `identifier` (bank ID) — manually entered transactions have no dedup protection
- No soft-delete — deleted transactions cannot be recovered
- `MerchantMap` normalization happens before category rule matching — merchant map data quality affects categorization accuracy

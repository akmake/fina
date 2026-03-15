> Last updated: 2026-03-12

# Module: Investments

## Overview

Tracks all investment assets: stocks, mutual funds/ETFs, bank deposits, and pension accounts.
Feeds into Net Worth calculation and Portfolio summary page.

## User Flow

```
Investment Portfolio page:
  ├── View totals by type (stocks / funds / deposits / pension)
  ├── Stocks tab → add/edit/delete stock holdings
  ├── Funds tab → add/edit/delete fund holdings
  ├── Deposits tab → add/edit/delete fixed-term deposits
  └── Pension tab → add/edit/delete pension accounts

Net Worth page:
  → Aggregates investments + bank accounts + real estate - loans - debts
  → Creates NetWorthSnapshot for historical tracking
```

## Key Files

| File | Role |
|------|------|
| `server/models/Stock.js` | Stock holdings schema |
| `server/models/Fund.js` | Fund/ETF schema |
| `server/models/Deposit.js` | Bank deposit schema |
| `server/models/Pension.js` | Pension account schema |
| `server/models/NetWorthSnapshot.js` | Historical net worth snapshots |
| `server/routes/stockRoutes.js` | Stock CRUD routes |
| `server/routes/fundRoutes.js` | Fund CRUD routes |
| `server/routes/depositRoutes.js` | Deposit CRUD routes |
| `server/routes/pensionRoutes.js` | Pension CRUD routes |
| `client/src/stores/stockStore.js` | Stock state |
| `client/src/stores/fundStore.js` | Fund state |
| `client/src/stores/depositsStore.js` | Deposits state |

## Schema: Stock

```js
{
  user: ObjectId,
  symbol: String,         // e.g. "AAPL"
  name: String,
  quantity: Number,
  purchasePrice: Number,
  currentPrice: Number,   // may be manually updated
  purchaseDate: Date,
  currency: String
}
```

## Schema: Deposit

```js
{
  user: ObjectId,
  bank: String,
  amount: Number,
  interestRate: Number,   // annual %
  startDate: Date,
  endDate: Date,
  currency: String,
  isLinked: Boolean       // linked to prime rate?
}
```

## Schema: Pension

```js
{
  user: ObjectId,
  provider: String,
  monthlyContribution: Number,
  employerContribution: Number,
  currentValue: Number,
  retirementAge: Number,
  trackingId: String
}
```

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST/PUT/DELETE | `/api/stocks` | Yes | Stock CRUD |
| GET/POST/PUT/DELETE | `/api/funds` | Yes | Fund CRUD |
| GET/POST/PUT/DELETE | `/api/deposits` | Yes | Deposit CRUD |
| GET/POST/PUT/DELETE | `/api/pension` | Yes | Pension CRUD |
| GET | `/api/investments` | Yes | Portfolio overview / aggregates |
| GET/POST | `/api/net-worth` | Yes | Net worth history |

## Schemas Used

See [docs/database.md](../database.md) for full schema reference.

| Model | Key fields used in this module |
|-------|-------------------------------|
| `Stock` | `symbol`, `name`, `quantity`, `purchasePrice`, `currentPrice`, `currency` |
| `Fund` | `name`, `type`, `value`, `units`, `purchaseDate` |
| `Deposit` | `bank`, `amount`, `interestRate`, `startDate`, `endDate`, `currency` |
| `Pension` | `provider`, `monthlyContribution`, `employerContribution`, `currentValue` |
| `NetWorthSnapshot` | `assets`, `liabilities`, `netWorth`, `date` |

## Coupling

| If you change... | Also update... |
|-----------------|----------------|
| `server/models/Stock.js` | `client/src/stores/stockStore.js`, net worth calculation logic, `docs/database.md` |
| `server/models/Fund.js` | `client/src/stores/fundStore.js`, net worth calculation logic, `docs/database.md` |
| `server/models/Deposit.js` | `client/src/stores/depositsStore.js`, net worth calculation logic, `docs/database.md` |
| `server/models/Pension.js` | Pension page, net worth calculation logic, `docs/database.md` |
| `server/models/NetWorthSnapshot.js` | Dashboard endpoint (`server/routes/dashboardRoutes.js`), analytics endpoint, `docs/modules/analytics.md` |
| Any investment model total calculation | `server/routes/netWorthRoutes.js`, `server/controllers/dashboardController.js` |

## Coupling Warnings (narrative)

- `NetWorthSnapshot` aggregates values from Stocks + Funds + Deposits + Pension + RealEstate - Loans - Debts — changing any of these models can affect net worth totals
- `depositsStore.js`, `fundStore.js`, `stockStore.js` are separate Zustand stores — they must all be fetched for portfolio totals
- Current stock prices are manually entered (no live feed integration)

## Known Issues / Pitfalls

- Stock `currentPrice` is static — there's no automatic price update mechanism
- No tax calculation on investment gains
- `Investment.js` model exists separately from `Stock`, `Fund`, etc. — its exact role is unknown (requires clarification)

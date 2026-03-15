> Last updated: 2026-03-12

# Module: Loans

## Overview

Tracks personal loans, mortgages, and debts. Calculates amortization schedules.
Loan/mortgage balances feed into Net Worth as liabilities.

## User Flow

```
Loans page:
  ├── View all loans with remaining balance, monthly payment
  ├── Add loan → enter principal, rate, term → auto-calculate amortization
  ├── View amortization schedule (month-by-month)
  └── Edit / delete loan

Mortgage page (separate):
  ├── Similar to loans but with property reference
  └── Linked to RealEstate document

Debts page:
  └── Simple debt tracking (no amortization)
```

## Key Files

| File | Role |
|------|------|
| `server/models/Loan.js` | Loan schema with amortization |
| `server/models/Mortgage.js` | Mortgage schema |
| `server/models/RateHistory.js` | Interest rate history (for variable-rate loans) |
| `server/routes/loanRoutes.js` | Loan CRUD + amortization route |
| `server/controllers/loanController.js` | Loan logic + amortization calculation |
| `server/routes/mortgageRoutes.js` | Mortgage routes |
| `server/controllers/mortgageController.js` | Mortgage logic |

## Schema: Loan

```js
{
  user: ObjectId,
  name: String,
  type: String,             // e.g. 'personal', 'car', 'student'
  principal: Number,
  interestRate: Number,     // annual %
  termMonths: Number,
  startDate: Date,
  monthlyPayment: Number,   // calculated
  remainingBalance: Number, // updated over time
  lender: String,
  notes: String
}
```

## Schema: Mortgage

```js
{
  user: ObjectId,
  property: String,          // property address or ref to RealEstate
  principal: Number,
  interestRate: Number,
  termMonths: Number,
  startDate: Date,
  monthlyPayment: Number,
  remainingBalance: Number,
  rateType: String           // 'fixed' | 'variable' | 'prime-linked'
}
```

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/loans` | Yes | List all loans |
| POST | `/api/loans` | Yes | Create loan (auto-calc amortization) |
| PUT | `/api/loans/:id` | Yes | Update loan |
| DELETE | `/api/loans/:id` | Yes | Delete loan |
| GET | `/api/loans/:id/amortization` | Yes | Full amortization schedule |
| GET | `/api/mortgage` | Yes | List mortgages |
| POST | `/api/mortgage` | Yes | Create mortgage |
| PUT | `/api/mortgage/:id` | Yes | Update |
| DELETE | `/api/mortgage/:id` | Yes | Delete |
| GET/POST/PUT/DELETE | `/api/debts` | Yes | Debt tracking CRUD |

## Schemas Used

See [docs/database.md](../database.md) for full schema reference.

| Model | Key fields used in this module |
|-------|-------------------------------|
| `Loan` | `type`, `principal`, `interestRate`, `termMonths`, `startDate`, `monthlyPayment`, `remainingBalance` |
| `Mortgage` | `property`, `principal`, `interestRate`, `termMonths`, `rateType`, `remainingBalance` |
| `RateHistory` | `date`, `rate`, `type` |

## Coupling

| If you change... | Also update... |
|-----------------|----------------|
| `server/models/Loan.js` | `server/controllers/loanController.js` (amortization calc), `server/routes/loanRoutes.js`, `docs/database.md` |
| `server/models/Mortgage.js` | `server/models/RealEstate.js` (`mortgageId` ref), `server/controllers/mortgageController.js`, `docs/modules/real-estate.md`, `docs/database.md` |
| Amortization calculation logic in `server/controllers/loanController.js` | `server/routes/loanRoutes.js` (amortization route), loan-related client pages |
| `server/models/RateHistory.js` | Variable-rate mortgage calculations in `server/controllers/mortgageController.js` |
| Any loan/debt balance field | `server/controllers/dashboardController.js` (net worth liabilities total), `server/routes/netWorthRoutes.js` |

## Coupling Warnings (narrative)

- Loans and mortgages appear as **liabilities** in Net Worth calculation — `NetWorthSnapshot` must be regenerated after any change
- `RateHistory` is used by variable-rate mortgages — if rate history is missing, variable-rate calculations will be inaccurate
- Mortgage `property` field may reference `RealEstate._id` — deleting a property may leave orphaned mortgages

## Known Issues / Pitfalls

- `remainingBalance` may need manual updates or a scheduled job — there's no automated payment tracking
- Israeli mortgage tracks ("מסלולים") with multiple tracks per mortgage are not explicitly modeled — requires clarification

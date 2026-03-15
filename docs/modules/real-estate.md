> Last updated: 2026-03-12

# Module: Real Estate & Insurance

## Overview

Tracks owned properties and insurance policies.
Properties feed into Net Worth as assets.
Each property can be linked to a Mortgage document.

## Key Files

| File | Role |
|------|------|
| `server/models/RealEstate.js` | Property schema |
| `server/models/Insurance.js` | Insurance policy schema |
| `server/routes/realEstateRoutes.js` | Real estate routes |
| `server/routes/insuranceRoutes.js` | Insurance routes |
| `server/controllers/realEstateController.js` | Real estate logic |
| `server/controllers/insuranceController.js` | Insurance logic |

## Schema: RealEstate

```js
{
  user: ObjectId,
  address: String,
  type: String,           // 'apartment' | 'house' | 'commercial'
  purchasePrice: Number,
  currentValue: Number,   // manually updated estimate
  purchaseDate: Date,
  mortgageId: ObjectId,   // optional ref to Mortgage
  area: Number,           // square meters
  notes: String
}
```

## Schema: Insurance

```js
{
  user: ObjectId,
  type: String,           // 'life' | 'health' | 'home' | 'car' | 'disability'
  provider: String,
  policyNumber: String,
  premium: Number,
  premiumFrequency: String, // 'monthly' | 'annual'
  coverage: Number,
  renewalDate: Date,
  notes: String
}
```

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST/PUT/DELETE | `/api/real-estate` | Yes | Property CRUD |
| GET/POST/PUT/DELETE | `/api/insurance` | Yes | Insurance policy CRUD |

## Schemas Used

See [docs/database.md](../database.md) for full schema reference.

| Model | Key fields used in this module |
|-------|-------------------------------|
| `RealEstate` | `address`, `type`, `purchasePrice`, `currentValue`, `purchaseDate`, `mortgageId` |
| `Insurance` | `type`, `provider`, `premium`, `premiumFrequency`, `coverage`, `renewalDate` |

## Coupling

| If you change... | Also update... |
|-----------------|----------------|
| `server/models/RealEstate.js` | `server/models/Mortgage.js` (`property` ref), `server/controllers/dashboardController.js` (net worth assets), `docs/database.md` |
| `RealEstate.currentValue` | Net worth snapshot logic in `server/routes/netWorthRoutes.js` |
| `RealEstate.mortgageId` | `server/models/Mortgage.js` (ensure consistent FK handling), `docs/modules/loans.md` |
| `server/models/Insurance.js` | `server/models/Alert.js` (renewal date alerts), `docs/database.md` |

## Coupling Warnings (narrative)

- `RealEstate.currentValue` feeds into Net Worth — manual update affects wealth calculation
- `RealEstate.mortgageId` links to `Mortgage` — deleting a property does not auto-delete the mortgage
- Insurance `renewalDate` is used for alerts — linked to `Alert` model

## Known Issues / Pitfalls

- Property value is manually maintained — no automated valuation
- Mortgage deletion and real-estate deletion are not cascading

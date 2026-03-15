> Last updated: 2026-03-12

# Database

## Connection

- **Provider:** MongoDB Atlas
- **Database name:** `corse`
- **ODM:** Mongoose 8.4.0
- **Config file:** `server/config/db.js`
- **Connection string env:** `MONGO_URI`

---

## All Models / Schemas

Located in `server/models/`.

### Core User & Auth

| Model | File | Key Fields |
|-------|------|-----------|
| `User` | `User.js` | `email`, `password` (hashed), `name`, `googleId`, `role` (`user`/`admin`), `createdAt` |

### Finance Core

| Model | File | Key Fields |
|-------|------|-----------|
| `Transaction` | `Transaction.js` | `user`, `amount`, `date`, `description`, `category`, `type` (income/expense), `account`, bank scraper fields (`identifier`, `processedDate`, `memo`) |
| `Category` | `Category.js` | `user`, `name`, `type`, `color`, `icon`, `isDefault` |
| `CategoryRule` | `CategoryRule.js` | `user`, `pattern` (regex/string), `category`, `priority` |
| `Budget` | `Budget.js` | `user`, `category`, `amount`, `period` (monthly/yearly), `startDate` |
| `Account` | `Account.js` | `user`, `name`, `type` (bank/credit/cash), `balance`, `currency`, `bankId` |
| `FinanceProfile` | `FinanceProfile.js` | `user`, income details, expense targets, risk profile |
| `RecurringTransaction` | `RecurringTransaction.js` | `user`, `amount`, `description`, `category`, `frequency`, `nextDate`, `isActive` |
| `NetWorthSnapshot` | `NetWorthSnapshot.js` | `user`, `date`, `assets`, `liabilities`, `netWorth` |

### Investments

| Model | File | Key Fields |
|-------|------|-----------|
| `Stock` | `Stock.js` | `user`, `symbol`, `name`, `quantity`, `purchasePrice`, `currentPrice`, `purchaseDate` |
| `Fund` | `Fund.js` | `user`, `name`, `type`, `value`, `units`, `purchaseDate` |
| `Deposit` | `Deposit.js` | `user`, `bank`, `amount`, `interestRate`, `startDate`, `endDate`, `currency` |
| `Pension` | `Pension.js` | `user`, `provider`, `monthlyContribution`, `employerContribution`, `currentValue`, `retirementAge` |
| `Investment` | `Investment.js` | `user`, portfolio-level investment tracking |

### Loans & Debt

| Model | File | Key Fields |
|-------|------|-----------|
| `Loan` | `Loan.js` | `user`, `type`, `principal`, `interestRate`, `termMonths`, `startDate`, `monthlyPayment`, amortization schedule |
| `Mortgage` | `Mortgage.js` | `user`, `property`, `principal`, `interestRate`, `termMonths`, `startDate`, tracks remaining balance |
| `RateHistory` | `RateHistory.js` | `date`, `rate`, `type` — interest rate historical data |

### Goals & Projects

| Model | File | Key Fields |
|-------|------|-----------|
| `Goal` | `Goal.js` | `user`, `name`, `targetAmount`, `currentAmount`, `deadline`, `category` |
| `Project` | `Project.js` | `user`, `name`, `type` (goal/task), `status`, `budget`, `tasks[]`, `deadline` |
| `ChildSavings` | `ChildSavings.js` | `user`, `childName`, `targetAmount`, `currentAmount`, `monthlyContribution`, `targetDate` |

### Real Estate & Insurance

| Model | File | Key Fields |
|-------|------|-----------|
| `RealEstate` | `RealEstate.js` | `user`, `address`, `purchasePrice`, `currentValue`, `purchaseDate`, `mortgageId` |
| `Insurance` | `Insurance.js` | `user`, `type`, `provider`, `premium`, `coverage`, `renewalDate` |

### System & Utility

| Model | File | Key Fields |
|-------|------|-----------|
| `Alert` | `Alert.js` | `user`, `type`, `threshold`, `condition`, `isActive`, `lastTriggered` |
| `ForeignCurrency` | `ForeignCurrency.js` | `user`, `currency`, `amount`, `purchaseRate`, `currentRate` |
| `Log` | `Log.js` | `timestamp`, `level`, `message`, `meta`, `userId`, `ip` |
| `MerchantMap` | `MerchantMap.js` | `originalName`, `cleanName`, `category` — merchant name normalization |
| `SystemConfig` | `SystemConfig.js` | Global config key/value pairs |
| `DataRecordModel` | `DataRecordModel.js` | Generic data records (flexible schema) |
| `Suggestion` | `Suggestion.js` | `user`, `type`, `content`, `isRead`, `createdAt` |
| `ElectricalProject` | `ElectricalProject.js` | `user`, `name`, `canvasData` (Fabric.js JSON), `components[]`, `createdAt` |

---

## Relationships

```
User
 ├─ has many → Transaction
 ├─ has many → Category
 ├─ has many → CategoryRule
 ├─ has many → Budget
 ├─ has many → Account
 ├─ has one  → FinanceProfile
 ├─ has many → RecurringTransaction
 ├─ has many → NetWorthSnapshot
 ├─ has many → Stock
 ├─ has many → Fund
 ├─ has many → Deposit
 ├─ has many → Pension
 ├─ has many → Loan
 ├─ has many → Mortgage
 ├─ has many → Goal
 ├─ has many → Project
 ├─ has many → ChildSavings
 ├─ has many → RealEstate
 ├─ has many → Insurance
 ├─ has many → Alert
 ├─ has many → ForeignCurrency
 ├─ has many → Suggestion
 └─ has many → ElectricalProject
```

All documents include `user` field (ObjectId ref to User) for tenant isolation. Queries always filter by `req.user._id`.

---

## Indexes

- `Transaction`: indexed on `user`, `date`, `category`
- `Category`: unique compound on `[user, name]`
- `Budget`: compound on `[user, category, period]`
- All user-scoped models: `user` field indexed for query performance

---

## Known Issues / Pitfalls

- Database name is `corse` (historical name — not `fina` or `finance`)
- `bcrypt` and `bcryptjs` are both in `package.json` — server uses `bcrypt` (native); client never hashes passwords
- No soft-delete pattern — documents are hard-deleted; no `deletedAt` field exists
- `DataRecordModel` has a flexible schema — unknown exactly what data types are stored there (requires clarification)

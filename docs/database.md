> Last updated: 2026-07-03

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
| `User` | `User.js` | `email`, `passwordHash`, `name`, `googleId`, `role` (`user`/`admin` — system-level), `activeHousehold`→`Household`, `familyGroup` (legacy), `tokenVersion`, `createdAt` |

### Tenancy (v2 — Households)

| Model | File | Key Fields |
|-------|------|-----------|
| `Household` | `Household.js` | `name`, `owner`→`User`, `plan` (`free`/`premium`), `isPersonal`, `inviteCode` — the tenant that owns all household-scoped data |
| `HouseholdMember` | `HouseholdMember.js` | `household`→`Household`, `user`→`User` (null while invited), `role` (`owner`/`partner`/`viewer`), `status` (`invited`/`active`/`removed`), `invitedBy`, `invitedEmail`, `inviteToken`, `tokenExpires`, `joinedAt` |

> **Scope note (Phase 1):** data isolation still runs through the per-document `user` field via `utils/scopeFilter.js`; `req.scopeUsers` is now derived from active `HouseholdMember`s (see `middlewares/familyScope.js`). Adding a physical `household` field to every business model is deferred (equivalent for the single-active-household model). `FamilyGroup` is superseded by `Household`; `/api/family` remains as a compatibility shim.

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
| `AuditLog` | `AuditLog.js` | `actor`, `action`, `entity`, `entityId`, `before`, `after`, `ip`, `at` — append-only, נכתב דרך `utils/audit.js` |
| `BankConnection` | `BankConnection.js` | `user`, `household`, `company`, `displayName`, `credentials` (AES-256-GCM blob, `select:false`), `otpLongTermToken` (encrypted, One Zero), `status` (`active`/`error`/`disabled`/`needs_otp`), `autoSync`, `incomesOnly`, `lastSyncAt`, `lastSyncStatus`, `lastInserted`, `nextSyncAt` — **soft delete**; secrets stripped from JSON. See [modules/import.md](modules/import.md) |
| `ImportJob` | `ImportJob.js` | `user`, `household`, `connection`, `company`, `trigger` (`manual`/`scheduled`), `status` (`queued`/`running`/`success`/`error`/`partial`), `startedAt`, `finishedAt`, `durationMs`, `stats{received,inserted,skipped,accounts}`, `balances[]`, `error` — logs; **TTL 90 days** |

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
 ├─ has many → BankConnection   (→ has many ImportJob)
 ├─ has many → ImportJob
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

## Soft Delete

Business entities use the `softDelete` plugin (`server/utils/softDelete.js`):
**Transaction, Budget, Goal, Loan, Account, BankConnection**.

- Adds `deletedAt` (default `null`); all `find`/`count`/`aggregate` queries auto-filter deleted docs
- Delete endpoints call `Model.softDeleteOne(filter)` / `softDeleteMany(filter)` instead of hard delete
- Access deleted docs with `.withDeleted()` query helper; restore with `Model.restoreOne(filter)`
- Unique indexes on Transaction and Budget are **partial** (`partialFilterExpression: { deletedAt: null }`) so a soft-deleted doc doesn't block re-creation
- `server.js` runs `syncIndexes()` for Transaction + Budget on startup to migrate the old unique indexes

Hard-deleted still: User (admin action, audited), Log cleanup, MerchantMap/CategoryRule management.

---

## Known Issues / Pitfalls

- Database name is `corse` (historical name — not `fina` or `finance`)
- Passwords hashed with `bcrypt` (native) on the server; `bcryptjs` was removed from dependencies
- `DataRecordModel` has a flexible schema — unknown exactly what data types are stored there (requires clarification)
- `centerModel.js` and the orphan store-era routes (`adminCenters`, `adminOrders`, `cartRoutes`) were deleted in Phase 0 cleanup

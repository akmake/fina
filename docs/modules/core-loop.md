> Last updated: 2026-07-05
> Status: Phase 3 (Core Loop) — in progress

# Module: Core Loop — notifications, budget cycle, rule learning, connected goals

The engine behind the product's core loop (§5.1):
`חיבור בנק → סנכרון → קטגוריזציה חכמה → תקציב חי → תובנה/התראה → פעולה`.
Phase 3 adds the server-side services that make that loop close automatically,
plus the UI consolidation (single dashboard, one asset portfolio, one import hub).

Related canonical docs (do not duplicate): [database.md](../database.md) (schemas),
[api-reference.md](../api-reference.md) (routes), [architecture.md](../architecture.md)
(env vars), [import.md](import.md) (Phase 2 sync).

---

## Pieces

| File | Role |
|------|------|
| `server/services/notificationService.js` | `notify` / `notifyMany` — single entry point to raise a notification, with stable-key **de-dup** + multi-channel delivery |
| `server/services/emailService.js` | Pluggable, dependency-free email adapter. Logs in dev; real transport plugged later. `EMAIL_ENABLED=true` to arm |
| `server/services/budgetCycleService.js` | `computeSpending` (shared with controller), `checkBudgetThresholds` (75/90/100), `rolloverToMonth` (carry-over) |
| `server/services/goalTrackingService.js` | `recomputeGoal` / `recomputeAllGoals` — goal `currentAmount` from linked category txns or deposit/fund balance |
| `server/controllers/categoryController.js` | Rule learning: `suggestRule`, `applyOneRule`/`buildRuleFilter`, `createRule` (`applyToExisting`) |
| `client/src/pages/ImportHubPage.jsx` | One tabbed import/connections hub (§6.1) |
| `client/src/pages/PortfolioHubPage.jsx` | One tabbed "תיק נכסים" (§6.1) |

The **in-app notification store is the existing `Alert` model** — there is no
separate `Notification` collection (that would duplicate it). `Alert` gained
`channels[]`, `emailSentAt`, `dedupeKey`, and a `bank_sync_failed` type.

---

## Notification engine

`notify({ user, type, title, message, ..., channels, dedupeKey, dedupeWindowMs })`:
1. **De-dup** — if a non-dismissed `Alert` with the same `dedupeKey` exists inside
   the window (default 24h), skip and return `{ created:false, reason:'deduped' }`.
   A dismissed alert does **not** block re-raising.
2. Create the in-app `Alert`; `message` falls back to `title` (Alert.message is required).
3. If `channels` includes `email`, send best-effort via `emailService`; set
   `emailSentAt` only on real delivery (never on the dev stub).

Callers: `importRunner` (bank_sync_failed / needs-OTP), `budgetCycleService`
(thresholds). `alertController.generateAlerts` delegates budget alerts to the
engine instead of its old inline 80/100 block.

## Budget cycle (§5.4)

- `checkBudgetThresholds({ filter, ownerId, month, year })` — for each category
  (and overall) raises the **highest** newly-crossed threshold of 75/90/100%,
  de-duped once per threshold per month. Endpoint: `POST /api/budgets/check-thresholds`.
- `rolloverToMonth({ ..., carryOver })` — copies the source month's category
  limits into the target month; with `carryOver`, each category's unspent
  balance is added to the new limit. No-op if the target month already exists.
  Endpoint: `POST /api/budgets/rollover`. `Budget.carryOverEnabled` stores the pref.

## Rule learning (§5.3)

- `POST /api/categories/rules/suggest` — from a `transactionId` or `{description,
  category}`, `deriveSearchString` strips reference numbers to a stable merchant
  token, counts how many household transactions it would affect, and reports if a
  rule already exists.
- `createRule` accepts `applyToExisting` → retro-categorizes matching past
  transactions and returns `appliedCount` (response stays backward-compatible —
  the rule object is still spread at the top level).
- `applyOneRule` / `buildRuleFilter` back both single-rule apply and apply-all;
  matching is household-scoped and prefers `rawDescription`, falling back to
  `description`.

## Connected goals (§5.6)

A goal's `trackingMode` selects the source of `currentAmount`:
- `manual` — hand-entered (default, unchanged).
- `category` — sum of `linkedCategory` transactions since `startDate`.
- `account` — balance of the linked `deposit` (`principal`) or `fund` (`current_value`).

`GET /api/goals` refreshes connected goals first (best-effort), so the list is
always live. `recomputeGoal` also advances milestones/completion. Forecast:
the `projectedDate` virtual = now + ceil(remaining / monthlyContribution).
Endpoints: `POST /api/goals/:id/recompute`, `POST /api/goals/recompute-all`.

---

## Gotchas

- De-dup relies on `dedupeKey`; always pass a stable one for recurring checks
  (e.g. `budget:<cat>:<threshold>:<YYYY-MM>`, `bank_sync_failed:<connId>`).
- `emailSentAt` is only set when a real transport delivered — the default stub
  returns `{ delivered:false }`, so it stays null in dev/tests.
- Threshold checks fire only the **highest** crossed level per run to avoid three
  alerts at once; lower levels already have their own (earlier) alerts.
- The UI hubs compose the existing pages as tab panels and resolve the active tab
  from the URL — old deep links (`/investments`, `/import/excel`, …) still work.

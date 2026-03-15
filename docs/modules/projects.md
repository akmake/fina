> Last updated: 2026-03-12

# Module: Projects & Goals

## Overview

Two related but distinct concepts:
- **Goals** — financial targets with a target amount and deadline (e.g., "Save 50,000₪ for a car")
- **Projects** — broader initiatives that may have tasks, budgets, and sub-goals
- **Child Savings** — dedicated savings tracking for children

## User Flow

```
Goals page:
  ├── View progress bars per goal (currentAmount / targetAmount)
  ├── Add goal → name, target, deadline
  └── Update progress → edit currentAmount

Projects page:
  ├── View project cards with status and budget
  ├── Add project → name, type, budget, deadline, tasks
  ├── Manage tasks within a project
  └── Track project completion

Child Savings page:
  ├── Track savings per child
  └── Calculate projected completion date
```

## Key Files

| File | Role |
|------|------|
| `server/models/Goal.js` | Goal schema |
| `server/models/Project.js` | Project + tasks schema |
| `server/models/ChildSavings.js` | Child savings schema |
| `server/routes/goalRoutes.js` | Goal routes |
| `server/routes/projectRoutes.js` | Project routes |
| `server/routes/childSavingsRoutes.js` | Child savings routes |
| `server/controllers/projectController.js` | Project business logic |
| `client/src/stores/projectsStore.js` | Client project state |
| `client/src/utils/projects.js` | Projects API calls |

## Schema: Goal

```js
{
  user: ObjectId,
  name: String,
  targetAmount: Number,
  currentAmount: Number,
  deadline: Date,
  category: String,     // e.g. 'emergency-fund', 'vacation', 'car'
  color: String,
  icon: String
}
```

## Schema: Project

```js
{
  user: ObjectId,
  name: String,
  type: String,         // 'goal' | 'task-based'
  status: String,       // 'active' | 'completed' | 'paused'
  budget: Number,
  spent: Number,
  deadline: Date,
  tasks: [{
    name: String,
    isCompleted: Boolean,
    dueDate: Date
  }],
  notes: String
}
```

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST/PUT/DELETE | `/api/goals` | Yes | Goals CRUD |
| GET/POST/PUT/DELETE | `/api/projects` | Yes | Projects CRUD |
| GET/POST/PUT/DELETE | `/api/child-savings` | Yes | Child savings CRUD |

## Schemas Used

See [docs/database.md](../database.md) for full schema reference.

| Model | Key fields used in this module |
|-------|-------------------------------|
| `Goal` | `name`, `targetAmount`, `currentAmount`, `deadline`, `category` |
| `Project` | `name`, `type`, `status`, `budget`, `spent`, `tasks[]`, `deadline` |
| `ChildSavings` | `childName`, `targetAmount`, `currentAmount`, `monthlyContribution`, `targetDate` |

## Coupling

| If you change... | Also update... |
|-----------------|----------------|
| `server/models/Project.js` | `client/src/stores/projectsStore.js`, `client/src/utils/projects.js`, `docs/database.md` |
| `server/models/Goal.js` | `server/routes/goalRoutes.js`, `server/controllers/goalController.js`, `docs/database.md` |
| `client/src/stores/projectsStore.js` | `client/src/utils/projects.js` (API calls), Projects page, Goals overview page |
| `client/src/utils/projects.js` | `client/src/stores/projectsStore.js` (depends on this for API calls) |

## Coupling Warnings (narrative)

- `projectsStore.js` uses `client/src/utils/projects.js` for API calls — not the generic `api.js` directly
- Goals `currentAmount` is manually updated — there is no automatic linkage to Transaction amounts

## Known Issues / Pitfalls

- No automatic goal progress update from transactions — manual update required
- `Project.type` has 'goal' overlap with `Goal` model — the distinction may be unclear in the UI

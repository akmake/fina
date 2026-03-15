> Last updated: 2026-03-12

# Module: Analytics & Dashboard

## Overview

Provides financial summaries, charts, and insights.
Dashboard is the app's home page after login.
Analytics provides deeper trend analysis and reporting.

## User Flow

```
/finance-dashboard (default landing page):
  ├── Monthly income vs. expenses summary
  ├── Budget progress bars per category
  ├── Recent transactions list
  ├── Net worth widget
  ├── Alerts widget
  └── Quick actions

Analytics page:
  ├── Income/expense trends (line/bar charts via Recharts)
  ├── Spending by category (pie chart)
  ├── Monthly comparison
  └── Year-over-year view

Reports page:
  └── Generate PDF or Excel export of financial data
```

## Key Files

| File | Role |
|------|------|
| `server/routes/analyticsRoutes.js` | Analytics data endpoint |
| `server/routes/dashboardRoutes.js` | Dashboard summary endpoint |
| `server/routes/reportRoutes.js` | Report generation |
| `server/controllers/analyticsController.js` | Aggregation queries |
| `server/controllers/dashboardController.js` | Dashboard data assembly |
| `server/middlewares/loggingMiddleware.js` | Visitor analytics (device, screen, connection) |
| `server/models/Log.js` | Visitor log storage |
| `client/src/pages/DashboardPage.jsx` | Main dashboard |
| `client/src/components/dashboard/` | Dashboard sub-components |

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard` | Yes | Dashboard summary (income, expenses, budget, net worth) |
| GET | `/api/analytics` | Yes | Analytics data (trends, by category, date range) |
| GET | `/api/reports` | Yes | Report data / PDF generation |
| GET | `/api/admin/logs` | Admin | View visitor/system logs |
| GET | `/api/admin/user-activity` | Admin | User activity tracking |

## Dashboard Data Composition

The dashboard endpoint aggregates from multiple collections in a single response:
- Transactions (monthly summary)
- Budgets (progress per category)
- Alerts (active alerts)
- NetWorthSnapshot (latest value)
- Suggestions (AI recommendations)

## Logging / Visitor Analytics

`loggingMiddleware.js` runs on every request and records:
- Screen resolution, hardware concurrency
- Network connection type
- User agent
- IP address
- Request path and user ID

Stored in `Log` model. Viewable via `/api/admin/logs` (admin only).

## Schemas Used

See [docs/database.md](../database.md) for full schema reference.

| Model | Key fields used in this module |
|-------|-------------------------------|
| `Transaction` | `amount`, `date`, `category`, `type` — aggregated for trends |
| `Budget` | `category`, `amount`, `period` — compared against transaction totals |
| `NetWorthSnapshot` | `netWorth`, `date` — latest snapshot for dashboard widget |
| `Alert` | `type`, `isActive`, `lastTriggered` — active alerts for dashboard |
| `Suggestion` | `content`, `type`, `isRead` — AI suggestions widget |
| `Log` | `timestamp`, `userId`, `ip`, `meta` — admin log viewer |

## Coupling

| If you change... | Also update... |
|-----------------|----------------|
| `server/controllers/dashboardController.js` response shape | `client/src/pages/DashboardPage.jsx`, `client/src/components/dashboard/` — all dashboard widgets depend on this shape |
| `server/controllers/analyticsController.js` response shape | All chart components in `client/src/` that consume analytics data |
| `server/middlewares/loggingMiddleware.js` (log fields) | `server/models/Log.js` (schema must match), admin log viewer page |
| Dashboard aggregation adds/removes a model | `server/controllers/dashboardController.js`, `docs/modules/analytics.md` |

## Coupling Warnings (narrative)

- Dashboard endpoint is a heavy aggregation — adding fields requires careful indexing
- Recharts components depend on the specific data shape returned by `/api/analytics` — changing the API response structure requires updating chart components
- PDF generation (`jsPDF`) and Excel export (`XLSX`) are client-side — large datasets may cause browser performance issues

## Known Issues / Pitfalls

- Suggestions (`/api/suggestions`) are described as "AI-generated" but the AI source/integration is unknown — requires clarification
- Analytics date-range filtering behavior at month boundaries requires validation

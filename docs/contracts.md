> Last updated: 2026-03-12

# Contracts — Project Conventions

Canonical source for: conventions, response formats, naming patterns, and structural rules.
AI agents must not rediscover these every session — read this file once and apply consistently.

---

## API Response Format

All API responses follow this envelope:

**Success:**
```json
{
  "success": true,
  "data": <payload>,
  "message": "optional success message"
}
```

**Error:**
```json
{
  "success": false,
  "message": "human-readable error string",
  "error": "optional detail / stack (dev only)"
}
```

**HTTP Status Codes:**
| Code | Meaning |
|------|---------|
| 200 | Success (GET, PUT) |
| 201 | Created (POST) |
| 400 | Validation error (express-validator failures) |
| 401 | Unauthenticated — invalid or missing JWT cookie |
| 403 | Forbidden — CSRF failure or insufficient role |
| 404 | Resource not found |
| 429 | Rate limited |
| 500 | Server error |

**CSRF errors specifically return:**
`403` with `{ message: "CSRF validation failed" }` (or similar)

---

## Naming Conventions

### Files
| Pattern | Convention | Example |
|---------|-----------|---------|
| Models | PascalCase | `Transaction.js`, `ChildSavings.js` |
| Routes | camelCase + "Routes" suffix | `transactionRoutes.js`, `authRoutes.js` |
| Controllers | camelCase + "Controller" suffix | `transactionController.js` |
| Client pages | PascalCase + "Page" suffix | `TransactionsPage.jsx`, `LoginPage.jsx` |
| Client stores | camelCase + "Store" suffix | `authStore.js`, `projectsStore.js` |
| Client utils | camelCase | `api.js`, `formatters.js`, `electricalEngine.js` |
| Client components | PascalCase | `ProtectedRoute.jsx`, `Navbar.jsx` |

### Variables & Fields
- MongoDB document IDs: `_id` (Mongoose default) — client may receive as `id` (virtuals)
- User reference field in all models: `user` (ObjectId, always required)
- Timestamps: `createdAt`, `updatedAt` (Mongoose `timestamps: true`)
- Soft delete: **not used** — hard delete only

### Routes
- All API routes prefixed with `/api/`
- RESTful convention: plural nouns (`/api/transactions`, `/api/users`)
- Sub-resources: `/api/loans/:id/amortization`
- No versioning prefix (`/api/v1/`) — flat namespace

---

## Folder Structure Conventions

### Adding a New Server Module

1. Create `server/models/<ModelName>.js`
2. Create `server/routes/<name>Routes.js`
3. Create `server/controllers/<name>Controller.js`
4. Mount in `server/app.js`: `app.use('/api/<name>', require('./routes/<name>Routes'))`
5. Add to `docs/api-reference.md` and `docs/database.md`
6. Create `docs/modules/<name>.md`
7. Update `docs/sync-map.md`

### Adding a New Client Page

1. Create `client/src/pages/<Name>Page.jsx`
2. Add route in `client/src/App.jsx` inside `<ProtectedRoute>` wrapper
3. If new store needed: create `client/src/stores/<name>Store.js`
4. Update `docs/state-management.md` if store added

---

## Validation Pattern

Server-side validation uses `express-validator`:
```js
// Pattern used in route files
const { body, validationResult } = require('express-validator')

router.post('/', [
  body('field').notEmpty().withMessage('Field is required'),
  // ...
], controller.create)
```

Validation errors return `400` with the standard error envelope.
Client does not duplicate server validation — only UX-level feedback.

---

## Auth Header Convention

CSRF protection uses a **custom request header** (not a token in the body):
```
X-Fina-Client: web-app
```

This header is added automatically by the Axios interceptor in `client/src/utils/api.js`.
Never add it manually to individual requests — the interceptor handles it globally.

---

## Zustand Store Pattern

All Zustand stores follow this structure:
```js
import { create } from 'zustand'
import api from '../utils/api'

export const useXxxStore = create((set, get) => ({
  items: [],
  isLoading: false,

  fetchItems: async () => {
    set({ isLoading: true })
    const { data } = await api.get('/xxx')
    set({ items: data.data, isLoading: false })
  },

  addItem: async (payload) => {
    const { data } = await api.post('/xxx', payload)
    set(state => ({ items: [...state.items, data.data] }))
  },
}))
```

Stores are named `use<Name>Store` and exported as named exports.

---

## Currency & Locale

- Primary currency: ILS (Israeli Shekel ₪)
- Locale: `he-IL`
- Formatting: `client/src/utils/formatters.js` — all currency/date formatting goes here
- Never format currency inline in components — always use `formatters.js`
- RTL layout: enforced globally via `dir="rtl"` on `<html>`

---

## React Query Convention

React Query is used for server state with caching. Key conventions:
- `queryKey` always starts with the resource name: `['transactions', filters]`
- Mutations invalidate the relevant query key after success
- Stale time and cache time: unknown — requires clarification on QueryClient config in `main.jsx`

---

## Error Handling

- Server: global error handler in `server/middlewares/errorHandler.js`
- Client: Axios interceptor handles 401 (auto-refresh) and 403 (CSRF retry)
- Unhandled errors: displayed via `uiStore` toast system
- Console errors in production: unknown — requires clarification

---

## Environment Awareness

- `NODE_ENV=development`: detailed error messages, relaxed cookie flags
- `NODE_ENV=production`: sanitized errors, `secure: true` on cookies, HTTPS required
- Never rely on `NODE_ENV` to skip security checks — use it only for error verbosity

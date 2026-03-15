> Last updated: 2026-03-12

# State Management

All client-side state uses **Zustand 4.5.7**. No Redux, no Context API for global state.
Data fetching uses **TanStack React Query 5.83** for server state (caching, refetching).

---

## Store Files (`client/src/stores/`)

### `authStore.js`
**Purpose:** Authentication state — current user, login/logout.

| Field / Action | Type | Description |
|---------------|------|-------------|
| `user` | object \| null | Current logged-in user `{ id, name, email, role }` |
| `login(userData)` | action | Set user, persist to localStorage |
| `logout()` | action | Clear user, remove from localStorage |
| `isAuthenticated` | computed | `user !== null` |

**Consumers:** `ProtectedRoute.jsx`, `Navbar.jsx`, `api.js` (interceptor), all pages (to get `user.id`)

**Persistence:** localStorage (user object persisted across refreshes)

---

### `financeStore.js`
**Purpose:** Finance profile and summary data.

| Field / Action | Type | Description |
|---------------|------|-------------|
| `profile` | object \| null | FinanceProfile document |
| `fetchProfile()` | async action | GET `/api/finance` |
| `updateProfile(data)` | async action | POST `/api/finance` |

**Consumers:** Finance dashboard pages, profile settings

---

### `accountStore.js`
**Purpose:** Bank accounts.

| Field / Action | Type | Description |
|---------------|------|-------------|
| `accounts` | array | List of Account documents |
| `fetchAccounts()` | async action | GET `/api/accounts` (unknown — requires clarification on exact route) |
| `addAccount(data)` | async action | POST |
| `updateAccount(id, data)` | async action | PUT |
| `deleteAccount(id)` | async action | DELETE |

**Consumers:** Accounts page, Transaction form (account selector)

---

### `projectsStore.js`
**Purpose:** Projects CRUD with optimistic updates.

| Field / Action | Type | Description |
|---------------|------|-------------|
| `projects` | array | List of Project documents |
| `isLoading` | boolean | Fetch loading state |
| `fetchProjects()` | async action | GET `/api/projects` |
| `addProject(data)` | async action | POST `/api/projects` |
| `updateProject(id, data)` | async action | PUT `/api/projects/:id` |
| `deleteProject(id)` | async action | DELETE `/api/projects/:id` |

**Consumers:** Projects page, Goals overview

---

### `depositsStore.js`
**Purpose:** Bank deposits / fixed-term savings.

| Field / Action | Type | Description |
|---------------|------|-------------|
| `deposits` | array | List of Deposit documents |
| `fetchDeposits()` | async action | GET `/api/deposits` |
| `addDeposit(data)` | async action | POST |
| `updateDeposit(id, data)` | async action | PUT |
| `deleteDeposit(id)` | async action | DELETE |

**Consumers:** Deposits page, Net worth calculation

---

### `fundStore.js`
**Purpose:** Mutual funds / ETFs.

| Field / Action | Type | Description |
|---------------|------|-------------|
| `funds` | array | List of Fund documents |
| `fetchFunds()` | async action | GET `/api/funds` |
| `addFund(data)` | async action | POST |
| `updateFund(id, data)` | async action | PUT |
| `deleteFund(id)` | async action | DELETE |

**Consumers:** Funds page, Portfolio summary

---

### `stockStore.js`
**Purpose:** Stock portfolio tracking.

| Field / Action | Type | Description |
|---------------|------|-------------|
| `stocks` | array | List of Stock documents |
| `fetchStocks()` | async action | GET `/api/stocks` |
| `addStock(data)` | async action | POST |
| `updateStock(id, data)` | async action | PUT |
| `deleteStock(id)` | async action | DELETE |

**Consumers:** Stocks page, Portfolio summary, Net worth

---

### `electricalStore.js`
**Purpose:** Electrical CAD editor canvas state.

| Field / Action | Type | Description |
|---------------|------|-------------|
| `projects` | array | List of ElectricalProject documents |
| `activeProject` | object \| null | Currently open project |
| `canvasData` | object | Fabric.js canvas JSON state |
| `fetchProjects()` | async action | GET `/api/electrical` |
| `saveProject(data)` | async action | POST/PUT `/api/electrical` |
| `setActiveProject(project)` | action | Set current project |
| `updateCanvas(json)` | action | Update local canvas state (not persisted until save) |

**Consumers:** `ElectricalEditor.jsx`, `ElectricalProjects.jsx`

---

### `uiStore.js`
**Purpose:** UI state — modals, toasts, global loading.

| Field / Action | Type | Description |
|---------------|------|-------------|
| `modals` | object | `{ [modalId]: boolean }` — which modals are open |
| `toasts` | array | Active toast notifications |
| `openModal(id)` | action | Open a modal |
| `closeModal(id)` | action | Close a modal |
| `addToast(message, type)` | action | Show toast notification |
| `removeToast(id)` | action | Dismiss toast |

**Consumers:** All pages and components that show modals or toasts

---

## Data Fetching Pattern

Most data that requires pagination, caching, or background refetching uses **React Query** directly (not Zustand):

```jsx
// Example pattern used across pages
const { data, isLoading, error } = useQuery({
  queryKey: ['transactions', filters],
  queryFn: () => api.get('/transactions', { params: filters }).then(r => r.data)
})
```

React Query is initialized in `client/src/main.jsx` with a `QueryClient`.

**Rule of thumb:**
- **Zustand** → UI state, auth state, editor state, simple CRUD stores
- **React Query** → Server data with caching (transactions, analytics, dashboard)

---

## Server-Side Store

`server/stores/authStore.js` — likely a legacy file or in-memory token store. Not a primary pattern. Requires clarification on its current usage.

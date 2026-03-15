> Last updated: 2026-03-12

# Module: Electrical CAD

## Overview

Embedded electrical planning / CAD tool within the finance app.
Uses **Fabric.js 7.2** for canvas-based drawing.
Projects are saved to MongoDB as serialized canvas JSON.

## User Flow

```
Electrical Projects page:
  ├── View saved projects list
  ├── Open project → load canvas JSON into Fabric.js
  ├── Draw components (outlets, switches, lights, panels)
  ├── Calculate material costs from component counts
  ├── Save → serialize canvas → PUT /api/electrical/:id
  └── Export (unknown format — requires clarification)
```

## Key Files

| File | Role |
|------|------|
| `server/models/ElectricalProject.js` | Schema (name, canvasData JSON, components) |
| `server/routes/electricalRoutes.js` | CRUD routes |
| `server/controllers/electricalController.js` | Controller |
| `client/src/stores/electricalStore.js` | Canvas state + projects list |
| `client/src/utils/electricalEngine.js` | Component definitions, pricing logic, calculations |
| `client/src/components/electrical/` | All editor UI components |
| `client/src/pages/ElectricalProjectsPage.jsx` | Projects list page |
| `client/src/pages/ElectricalEditorPage.jsx` | Canvas editor page |

## Schema: ElectricalProject

```js
{
  user: ObjectId,
  name: String,
  canvasData: Object,     // Fabric.js JSON (serialized canvas state)
  components: [{
    type: String,         // component type identifier
    quantity: Number,
    position: Object
  }],
  totalCost: Number,      // calculated from components
  createdAt: Date,
  updatedAt: Date
}
```

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/electrical` | Yes | List user's electrical projects |
| POST | `/api/electrical` | Yes | Create new project |
| PUT | `/api/electrical/:id` | Yes | Save/update project (canvas + components) |
| DELETE | `/api/electrical/:id` | Yes | Delete project |

## Schemas Used

See [docs/database.md](../database.md) for full schema reference.

| Model | Key fields used in this module |
|-------|-------------------------------|
| `ElectricalProject` | `name`, `canvasData` (Fabric.js JSON blob), `components[]`, `totalCost` |

## Coupling

| If you change... | Also update... |
|-----------------|----------------|
| `server/models/ElectricalProject.js` (`canvasData` structure) | `client/src/utils/electricalEngine.js` (serialization/deserialization), `client/src/stores/electricalStore.js`, all electrical components, `docs/database.md` |
| `client/src/utils/electricalEngine.js` (component types or pricing) | `client/src/stores/electricalStore.js`, all electrical canvas components |
| Fabric.js version in `client/package.json` | Canvas JSON format may be incompatible — test save/load of all existing projects |
| `client/src/stores/electricalStore.js` | All `client/src/components/electrical/` components, `client/src/pages/ElectricalEditorPage.jsx` |

## Coupling Warnings (narrative)

- `canvasData` is a direct Fabric.js JSON blob — **Fabric.js version upgrades may break canvas serialization** — test thoroughly before upgrading
- `electricalEngine.js` contains pricing data for components — price changes require updating this file
- `electricalStore.js` holds live canvas state that is NOT persisted until explicit save — page refresh loses unsaved work
- This module is unrelated to finance — it shares only auth and user context

## Known Issues / Pitfalls

- No auto-save — users must manually save canvas work
- Export format/functionality requires clarification
- Component pricing in `electricalEngine.js` may be hardcoded in ILS — currency handling unclear
- Pergola planner (`pergolaEngine.js`, Three.js) is a parallel tool — both are non-finance features embedded in the app

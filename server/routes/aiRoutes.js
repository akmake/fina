// server/routes/aiRoutes.js
// Read-only data API for the Fina MCP server (/mcp) + AI key management.
// Mounted in app.js:  /api/ai       → apiKeyAuth (GET only) + resolveHousehold
//                     /api/ai-keys  → requireAuth (session) — create/list/revoke keys
// Contract: docs/modules/ai-mcp.md

import { Router } from 'express';
import { overview, searchTransactions, spending, connections, alerts, listKeys, createKey, revokeKey } from '../controllers/aiController.js';

export const aiDataRouter = Router();
aiDataRouter.get('/overview', overview);
aiDataRouter.get('/transactions', searchTransactions);
aiDataRouter.get('/spending', spending);
aiDataRouter.get('/connections', connections);
aiDataRouter.get('/alerts', alerts);

export const aiKeysRouter = Router();
aiKeysRouter.get('/', listKeys);
aiKeysRouter.post('/', createKey);
aiKeysRouter.delete('/:id', revokeKey);

// server/routes/aiRoutes.js
// Data API for the Fina MCP server (/mcp) + AI key management.
// Mounted in app.js:  /api/ai       → apiKeyAuth + resolveHousehold
//                     /api/ai-keys  → requireAuth (session) — create/list/revoke keys
// Reads need any AI key; the /categorize/* writes need a key created with the
// 'categorize' scope, and are refused for household viewers.
// Contract: docs/modules/ai-mcp.md

import { Router } from 'express';
import { requireAiScope } from '../middlewares/apiKeyAuth.js';
import { blockViewerWrites } from '../middlewares/familyScope.js';
import {
  overview, searchTransactions, spending, connections, alerts, categories,
  renameMerchant, setMerchantCategory, setTransactionCategory, renameCategory,
  listKeys, createKey, revokeKey,
} from '../controllers/aiController.js';

export const aiDataRouter = Router();
aiDataRouter.get('/overview', overview);
aiDataRouter.get('/transactions', searchTransactions);
aiDataRouter.get('/spending', spending);
aiDataRouter.get('/connections', connections);
aiDataRouter.get('/alerts', alerts);
aiDataRouter.get('/categories', categories);

const canCategorize = [requireAiScope('categorize'), blockViewerWrites];
aiDataRouter.post('/categorize/merchant-name', canCategorize, renameMerchant);
aiDataRouter.post('/categorize/merchant-category', canCategorize, setMerchantCategory);
aiDataRouter.post('/categorize/transaction-category', canCategorize, setTransactionCategory);
aiDataRouter.post('/categorize/rename-category', canCategorize, renameCategory);

export const aiKeysRouter = Router();
aiKeysRouter.get('/', listKeys);
aiKeysRouter.post('/', createKey);
aiKeysRouter.delete('/:id', revokeKey);

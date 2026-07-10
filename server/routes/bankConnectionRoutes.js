// server/routes/bankConnectionRoutes.js
// Saved bank connections + unattended sync (Phase 2, Import 2.0).
// Mounted at /api/connections behind requireAuth + familyScope in app.js.

import { Router } from 'express';
import { scrapeLimiter } from '../middlewares/rateLimiter.js';
import { enforceLimit } from '../middlewares/planGate.js';
import BankConnection from '../models/BankConnection.js';
import { scopeFilter } from '../utils/scopeFilter.js';
import {
  listCompanies,
  listConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  syncConnection,
  listConnectionJobs,
  getJob,
} from '../controllers/bankConnectionController.js';

const router = Router();

// Free-tier plan cap: count the household's existing (non-deleted) connections.
const countConnections = (req) => BankConnection.countDocuments(scopeFilter(req));

// Metadata: which credential fields each supported institution needs.
router.get('/companies', listCompanies);

// Job polling (static path — declared before the /:id params).
router.get('/jobs/:id', getJob);

router.get('/', listConnections);
// Plan gate: free tier caps connected accounts (returns 402 when the cap is hit).
router.post('/', enforceLimit('bankConnections', countConnections), createConnection);

router.get('/:id/jobs', listConnectionJobs);
// Each sync launches a headless browser — keep it under the scrape rate limiter.
router.post('/:id/sync', scrapeLimiter, syncConnection);

router.patch('/:id', updateConnection);
router.delete('/:id', deleteConnection);

export default router;

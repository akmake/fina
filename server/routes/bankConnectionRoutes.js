// server/routes/bankConnectionRoutes.js
// Saved bank connections + unattended sync (Phase 2, Import 2.0).
// Mounted at /api/connections behind requireAuth + familyScope in app.js.

import { Router } from 'express';
import { scrapeLimiter } from '../middlewares/rateLimiter.js';
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

// Metadata: which credential fields each supported institution needs.
router.get('/companies', listCompanies);

// Job polling (static path — declared before the /:id params).
router.get('/jobs/:id', getJob);

router.get('/', listConnections);
router.post('/', createConnection);

router.get('/:id/jobs', listConnectionJobs);
// Each sync launches a headless browser — keep it under the scrape rate limiter.
router.post('/:id/sync', scrapeLimiter, syncConnection);

router.patch('/:id', updateConnection);
router.delete('/:id', deleteConnection);

export default router;

import { Router } from 'express';
import { scrapeCompany, getCompanies } from '../controllers/scraperController.js';
import requireAuth from '../middlewares/requireAuth.js';

const router = Router();

router.use(requireAuth);

router.get('/companies', getCompanies);
router.post('/', scrapeCompany);

export default router;

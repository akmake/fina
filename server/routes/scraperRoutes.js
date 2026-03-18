import { Router } from 'express';
import { scrapeCompany, getCompanies } from '../controllers/scraperController.js';

const router = Router();

router.get('/companies', getCompanies);
router.post('/', scrapeCompany);

export default router;

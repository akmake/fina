// server/routes/taxRoutes.js
import express from 'express';
import { calculateTax, getTaxBrackets } from '../controllers/taxController.js';
const router = express.Router();

router.get('/brackets', getTaxBrackets);
router.post('/calculate', calculateTax);

export default router;

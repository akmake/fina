// server/routes/mortgageRoutes.js
import express from 'express';
import { getMortgages, addMortgage, updateMortgage, deleteMortgage, simulateRefinance, primeScenario } from '../controllers/mortgageController.js';
const router = express.Router();

router.get('/', getMortgages);
router.post('/', addMortgage);
router.put('/:id', updateMortgage);
router.delete('/:id', deleteMortgage);
router.post('/:id/simulate-refinance', simulateRefinance);
router.get('/:id/prime-scenario', primeScenario);

export default router;

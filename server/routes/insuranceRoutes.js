// server/routes/insuranceRoutes.js
import express from 'express';
import { getInsurancePolicies, addInsurancePolicy, updateInsurancePolicy, deleteInsurancePolicy } from '../controllers/insuranceController.js';
const router = express.Router();

router.get('/', getInsurancePolicies);
router.post('/', addInsurancePolicy);
router.put('/:id', updateInsurancePolicy);
router.delete('/:id', deleteInsurancePolicy);

export default router;

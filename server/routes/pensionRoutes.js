// server/routes/pensionRoutes.js
import express from 'express';
import { 
  getPensionProducts, 
  addPensionProduct, 
  updatePensionProduct, 
  deletePensionProduct,
  getRetirementSimulation
} from '../controllers/pensionController.js';

const router = express.Router();

router.get('/',                        getPensionProducts);
router.get('/retirement-simulation',   getRetirementSimulation);
router.post('/',                       addPensionProduct);
router.put('/:id',                     updatePensionProduct);
router.delete('/:id',                  deletePensionProduct);

export default router;

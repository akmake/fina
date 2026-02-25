// server/routes/childSavingsRoutes.js
import express from 'express';
import { getChildSavings, addChildSavings, updateChildSavings, deleteChildSavings } from '../controllers/childSavingsController.js';
const router = express.Router();

router.get('/', getChildSavings);
router.post('/', addChildSavings);
router.put('/:id', updateChildSavings);
router.delete('/:id', deleteChildSavings);

export default router;

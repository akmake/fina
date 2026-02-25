// server/routes/goalRoutes.js
import express from 'express';
import { getGoals, addGoal, updateGoal, deleteGoal, depositToGoal } from '../controllers/goalController.js';
const router = express.Router();

router.get('/', getGoals);
router.post('/', addGoal);
router.put('/:id', updateGoal);
router.delete('/:id', deleteGoal);
router.post('/:id/deposit', depositToGoal);

export default router;

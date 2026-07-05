// server/routes/goalRoutes.js
import express from 'express';
import {
  getGoals, addGoal, updateGoal, deleteGoal, depositToGoal,
  recomputeGoalHandler, recomputeAllHandler,
} from '../controllers/goalController.js';
const router = express.Router();

router.get('/', getGoals);
router.post('/', addGoal);
router.post('/recompute-all', recomputeAllHandler);
router.put('/:id', updateGoal);
router.delete('/:id', deleteGoal);
router.post('/:id/deposit', depositToGoal);
router.post('/:id/recompute', recomputeGoalHandler);

export default router;

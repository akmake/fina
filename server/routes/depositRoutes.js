// server/routes/depositRoutes.js
import express from 'express';
import { getDeposits, addDeposit, breakDeposit, withdrawDeposit } from '../controllers/depositController.js';

const router = express.Router();

// כל הנתיבים כאן יהיו תחת /api/deposits ודורשים אימות
router.get('/', getDeposits);
router.post('/', addDeposit);
router.post('/:id/break', breakDeposit);       // פעולה לשבירת פיקדון
router.post('/:id/withdraw', withdrawDeposit); // פעולה למשיכת פיקדון

export default router;
import express from 'express';
import {
  getSuggestions,
  createSuggestion,
  updateSuggestionStatus,
  addReply,
  toggleVote,
  deleteSuggestion,
} from '../controllers/suggestionController.js';
import { requireAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// requireAuth כבר מופעל ב-app.js — אין צורך בכפילות

// GET / POST הצעות
router.route('/')
  .get(getSuggestions)
  .post(createSuggestion);

// מחיקת הצעה (מנהל או יוצר)
router.delete('/:id', deleteSuggestion);

// עדכון סטטוס — מנהל בלבד
router.put('/:id/status', requireAdmin, updateSuggestionStatus);

// תגובות — כל משתמש מחובר
router.post('/:id/replies', addReply);

// הצבעה
router.post('/:id/vote', toggleVote);

export default router;

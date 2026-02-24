import express from 'express';
import {
  getSuggestions,
  createSuggestion,
  updateSuggestionStatus,
  addReply,
  toggleVote,
  deleteSuggestion,
} from '../controllers/suggestionController.js';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// כל הנתיבים דורשים אימות
router.use(requireAuth);

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

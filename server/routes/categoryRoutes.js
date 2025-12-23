import express from 'express';
import { 
  getCategories, 
  createCategory, 
  deleteCategory,
  getRules,
  createRule,
  deleteRule,
  applyRulesToTransactions,
  syncCategoriesFromTransactions
} from '../controllers/categoryController.js';

// שימוש בשם המדויק מהקובץ authMiddleware.js שלך
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// החלת אימות על כל הנתיבים
router.use(requireAuth);

router.route('/')
    .get(getCategories)
    .post(createCategory);

router.route('/:id').delete(deleteCategory);

// נתיבי מנוע החוקים והסנכרון
router.get('/rules/all', getRules);
router.post('/rules', createRule);
router.delete('/rules/:id', deleteRule);
router.post('/rules/apply', applyRulesToTransactions);
router.post('/sync', syncCategoriesFromTransactions);

export default router;
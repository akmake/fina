import express from 'express';
import requireAuth from '../middlewares/requireAuth.js';
import {
  getManagementData,
  updateMerchantMap,
  deleteMerchantMap,
  createCategoryRule,
  updateCategoryRule,
  deleteCategoryRule,
  applyRulesRetroactively // ◀️ 1. הוספת הפונקציה החדשה לייבוא
} from '../controllers/managementController.js';
import { param } from 'express-validator';

const router = express.Router();

// כל הפעולות דורשות אימות
router.use(requireAuth);

// שליפת כל הנתונים לדף הניהול
router.get('/', getManagementData);

// ניהול מיפויי ספקים
router.route('/merchant-maps/:id')
  .put(param('id').isMongoId(), updateMerchantMap)
  .delete(param('id').isMongoId(), deleteMerchantMap);

// ניהול חוקי קטגוריות
router.route('/category-rules')
  .post(createCategoryRule);

router.route('/category-rules/:id')
  .put(param('id').isMongoId(), updateCategoryRule)
  .delete(param('id').isMongoId(), deleteCategoryRule);

// ◀️ 2. הוספת הנתיב החדש להפעלה רטרואקטיבית
router.post('/apply-rules', applyRulesRetroactively);

export default router;
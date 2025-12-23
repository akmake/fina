import express from 'express';
import { body, param } from 'express-validator';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';
import requireAuth            from '../middlewares/requireAuth.js';
import { handleValidationErrors } from '../utils/validators.js'; // כבר קיים בכלי-העזר שלך

const router = express.Router();
router.use(requireAuth);

router.route('/')
  .get(getCategories)
  .post(
    [
      body('name').trim().notEmpty().withMessage('חובה לציין שם קטגוריה'),
      body('type').optional().isIn(['הוצאה', 'הכנסה', 'כללי'])
        .withMessage("ה-type חייב להיות 'הוצאה', 'הכנסה' או 'כללי'"),
      handleValidationErrors
    ],
    createCategory
  );

router.route('/:id')
  .put(param('id').isMongoId(), updateCategory)
  .delete(param('id').isMongoId(), deleteCategory);

export default router;

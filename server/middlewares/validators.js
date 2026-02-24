import { body, param, query, validationResult } from 'express-validator';

// Centralized validation error handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

// Auth Validators
export const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),
  body('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Role must be either user or admin'),
];

export const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Transaction Validators
export const validateTransaction = [
  body('date')
    .isISO8601()
    .withMessage('Valid date is required'),
  body('description')
    .trim()
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('type')
    .isIn(['הוצאה', 'הכנסה', 'expense', 'income'])
    .withMessage('Type must be either expense or income'),
  body('category')
    .trim()
    .optional()
    .isLength({ max: 50 })
    .withMessage('Category must not exceed 50 characters'),
  body('account')
    .optional()
    .isIn(['checking', 'cash', 'deposits', 'stocks', 'עו"ש', 'מזומן'])
    .withMessage('Invalid account type'),
];

// Pagination Validators
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('sort')
    .optional()
    .isIn(['asc', 'desc', '-1', '1'])
    .withMessage('Sort must be asc or desc'),
];

// Generic ID Validator
export const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
];

// Search Term Validator
export const validateSearchTerm = [
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
];

import express from 'express';
import {
  getFinancialAnalytics,
  autoCategorizeBatch,
  getTransactionInsights,
  getSpendingRecommendations,
  predictSpending,
  getSeasonalAnalysis,
} from '../controllers/analyticsController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { catchAsync } from '../middlewares/errorHandler.js';
import rateLimiter from '../middlewares/rateLimiter.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);
router.use(rateLimiter);

/**
 * @route   GET /api/dashboard/smart-analytics
 * @desc    Get comprehensive financial analytics
 * @access  Private
 */
router.get('/smart-analytics', catchAsync(getFinancialAnalytics));

/**
 * @route   POST /api/dashboard/auto-categorize
 * @desc    Auto-categorize transactions using smart engine
 * @access  Private
 */
router.post('/auto-categorize', catchAsync(autoCategorizeBatch));

/**
 * @route   GET /api/dashboard/insights
 * @desc    Get detailed transaction insights
 * @access  Private
 */
router.get('/insights', catchAsync(getTransactionInsights));

/**
 * @route   GET /api/dashboard/recommendations
 * @desc    Get spending recommendations
 * @access  Private
 */
router.get('/recommendations', catchAsync(getSpendingRecommendations));

/**
 * @route   GET /api/dashboard/predictions
 * @desc    Get spending predictions
 * @access  Private
 */
router.get('/predictions', catchAsync(predictSpending));
router.get('/seasonal',    catchAsync(getSeasonalAnalysis));

export default router;

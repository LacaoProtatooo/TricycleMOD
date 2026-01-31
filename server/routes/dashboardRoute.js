import express from 'express';
import { getDashboardStats, getSentimentQuadrantData } from '../controllers/dashboardController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Dashboard Routes
 * Base path: /api/dashboard
 */

// Admin dashboard stats
router.get('/stats', protect, authorize('admin'), getDashboardStats);

// Sentiment quadrant data for scatter plot visualization
router.get('/sentiment-quadrant', protect, authorize('admin'), getSentimentQuadrantData);

export default router;

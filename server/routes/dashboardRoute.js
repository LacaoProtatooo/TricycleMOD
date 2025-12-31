import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Dashboard Routes
 * Base path: /api/dashboard
 */

// Admin dashboard stats
router.get('/stats', protect, authorize('admin'), getDashboardStats);

export default router;

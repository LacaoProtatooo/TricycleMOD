import express from 'express';
import {
  changeUserRole,
  getAdminActivityLogs,
  getAdminActivityLogDetails,
  getAdminActivityStats,
  suspendDriver,
  reinstateDriver,
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require admin authentication
router.use(protect, authorize('admin'));

// User management routes
router.put('/users/:userId/role', changeUserRole);

// Driver suspension routes
router.post('/drivers/:userId/suspend', suspendDriver);
router.post('/drivers/:userId/reinstate', reinstateDriver);

// Admin activity log routes
router.get('/logs', getAdminActivityLogs);
router.get('/logs/stats', getAdminActivityStats);
router.get('/logs/:logId', getAdminActivityLogDetails);

export default router;

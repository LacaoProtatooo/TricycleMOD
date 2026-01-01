import express from 'express';
import {
  changeUserRole,
  getAdminActivityLogs,
  getAdminActivityLogDetails,
  getAdminActivityStats,
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require admin authentication
router.use(protect, authorize('admin'));

// User management routes
router.put('/users/:userId/role', changeUserRole);

// Admin activity log routes
router.get('/logs', getAdminActivityLogs);
router.get('/logs/stats', getAdminActivityStats);
router.get('/logs/:logId', getAdminActivityLogDetails);

export default router;

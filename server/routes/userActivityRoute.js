import express from 'express';
import {
  updateHeartbeat,
  markOffline,
  getAllUsersWithActivity,
  getUserDetails,
} from '../controllers/userActivityController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// User activity routes (authenticated users)
router.post('/heartbeat', protect, updateHeartbeat);
router.post('/offline', protect, markOffline);

// Admin routes for viewing users
router.get('/users', protect, authorize('admin'), getAllUsersWithActivity);
router.get('/users/:userId', protect, authorize('admin'), getUserDetails);

export default router;

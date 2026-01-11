import express from 'express';
import {
  canFileComplaint,
  getDriversForComplaint,
  fileComplaint,
  getMyComplaints,
  getComplaintDetails,
  withdrawComplaint,
  getRecentBookings,
  getComplaintCategories,
  adminGetAllComplaints,
  adminUpdateComplaintStatus,
  adminResolveComplaint,
  adminAddNote,
  adminGetDriverComplaints,
} from '../controllers/complaintController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Complaint Routes
 * Base path: /api/complaints
 */

// Public route - get categories
router.get('/categories', getComplaintCategories);

// User routes (requires authentication)
router.get('/can-file', protect, canFileComplaint);
router.get('/drivers', protect, getDriversForComplaint);
router.get('/recent-bookings', protect, getRecentBookings);
router.get('/my-complaints', protect, getMyComplaints);
router.post('/', protect, fileComplaint);
router.get('/:id', protect, getComplaintDetails);
router.put('/:id/withdraw', protect, withdrawComplaint);

// Admin routes (requires admin role)
router.get('/admin/all', protect, authorize('admin'), adminGetAllComplaints);
router.get('/admin/driver/:driverId', protect, authorize('admin'), adminGetDriverComplaints);
router.put('/admin/:id/status', protect, authorize('admin'), adminUpdateComplaintStatus);
router.put('/admin/:id/resolve', protect, authorize('admin'), adminResolveComplaint);
router.post('/admin/:id/note', protect, authorize('admin'), adminAddNote);

export default router;

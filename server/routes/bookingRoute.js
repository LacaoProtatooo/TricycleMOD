import express from 'express';
import {
  createBooking,
  getUserBookings,
  getBookingDetails,
  getActiveBooking,
  driverRespondToBooking,
  respondToOffer,
  completeTrip,
  cancelBooking,
  rateDriver,
  getNearbyBookings,
  getDriverBookings,
  reportBooking,
} from '../controllers/bookingController.js';
import { protect, authorize, requireVerified, requireDriverLicense } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Booking Routes
 * Base path: /api/booking
 */

// User routes (requires verified account)
router.post('/create', protect, requireVerified, createBooking);
router.get('/user', protect, getUserBookings);
router.get('/active', protect, getActiveBooking);
router.post('/:id/respond-offer', protect, requireVerified, respondToOffer);
router.post('/:id/rate', protect, rateDriver);

// Driver routes (requires verified license)
router.get('/nearby', protect, authorize('driver'), getNearbyBookings);
router.get('/driver', protect, authorize('driver'), getDriverBookings);
router.post('/:id/driver-respond', protect, authorize('driver'), requireDriverLicense, driverRespondToBooking);

// Shared routes (user or driver)
router.get('/:id', protect, getBookingDetails);
router.post('/:id/complete', protect, completeTrip);
router.post('/:id/cancel', protect, cancelBooking);
router.post('/:id/report', protect, reportBooking);

export default router;

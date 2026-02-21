import express from 'express';
import {
  createBooking,
  getUserBookings,
  getBookingDetails,
  getActiveBooking,
  driverRespondToBooking,
  respondToOffer,
  startTrip,
  completeTrip,
  confirmCompletion,
  cancelBooking,
  rateDriver,
  getNearbyBookings,
  getDriverBookings,
  reportBooking,
  adminGetAllBookings,
  adminGetBookingDetails,
  adminGetBookingStats,
  getBookingOffers,
  withdrawOffer,
  getDriverPendingOffers,
} from '../controllers/bookingController.js';
import { protect, authorize, requireVerified } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Booking Routes
 * Base path: /api/booking
 */

// Admin routes (requires admin role)
router.get('/admin/all', protect, authorize('admin'), adminGetAllBookings);
router.get('/admin/stats', protect, authorize('admin'), adminGetBookingStats);
router.get('/admin/:id', protect, authorize('admin'), adminGetBookingDetails);

// User routes (requires verified account)
router.post('/create', protect, requireVerified, createBooking);
router.get('/user', protect, getUserBookings);
router.get('/active', protect, getActiveBooking);
router.get('/:id/offers', protect, getBookingOffers);  // Get all offers for a booking
router.post('/:id/respond-offer', protect, requireVerified, respondToOffer);
router.post('/:id/confirm-completion', protect, requireVerified, confirmCompletion);
router.post('/:id/rate', protect, rateDriver);

// Driver routes (requires verified license)
router.get('/nearby', protect, authorize('driver'), getNearbyBookings);
router.get('/driver', protect, authorize('driver'), getDriverBookings);
router.get('/driver/pending-offers', protect, authorize('driver'), getDriverPendingOffers);  // Get driver's pending offers
router.post('/:id/driver-respond', protect, authorize('driver'), driverRespondToBooking);
router.post('/:id/withdraw-offer', protect, authorize('driver'), withdrawOffer);  // Withdraw driver's offer
router.post('/:id/start-trip', protect, authorize('driver'), startTrip);

// Shared routes (user or driver)
router.get('/:id', protect, getBookingDetails);
router.post('/:id/complete', protect, completeTrip);
router.post('/:id/cancel', protect, cancelBooking);
router.post('/:id/report', protect, reportBooking);

export default router;

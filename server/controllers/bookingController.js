import Booking from '../models/bookingModel.js';
import User from '../models/userModel.js';
import Review from '../models/reviewModel.js';
import { messaging } from '../utils/firebase.js';

/**
 * Booking Controller - Handles special trip booking operations
 */

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Helper function to send FCM notification
const sendNotification = async (fcmToken, title, body, data = {}) => {
  if (!messaging || !fcmToken) {
    console.log('Cannot send notification: messaging not available or no FCM token');
    return null;
  }

  try {
    const message = {
      notification: { title, body },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      token: fcmToken,
    };
    
    const response = await messaging.send(message);
    console.log('Notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending notification:', error);
    return null;
  }
};

/**
 * Create a new booking request
 * POST /api/booking/create
 */
export const createBooking = async (req, res) => {
  try {
    const { pickup, destination, preferredFare, userLocation } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!pickup || !destination || !preferredFare) {
      return res.status(400).json({
        success: false,
        message: 'Pickup, destination, and preferred fare are required',
      });
    }

    // Check if user already has an active booking
    const existingBooking = await Booking.findOne({
      user: userId,
      status: { $in: ['pending', 'offer_made', 'accepted', 'in_progress', 'awaiting_confirmation'] },
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active booking',
      });
    }

    // Create the booking
    const booking = new Booking({
      user: userId,
      pickup,
      destination,
      preferredFare,
      userLocationAtBooking: userLocation || pickup,
    });

    await booking.save();

    // Find and notify nearby active drivers
    const nearbyDrivers = await findAndNotifyNearbyDrivers(booking);
    booking.notifiedDrivers = nearbyDrivers.map(d => d._id);
    await booking.save();

    // Populate user data for response
    await booking.populate('user', 'firstname lastname rating image');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking,
      driversNotified: nearbyDrivers.length,
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message,
    });
  }
};

/**
 * Find and notify nearby active drivers
 */
const findAndNotifyNearbyDrivers = async (booking, radiusKm = 5) => {
  try {
    // Find active drivers (drivers with FCM tokens who are online)
    const drivers = await User.find({
      role: 'driver',
      FCMToken: { $exists: true, $ne: null },
    }).select('_id firstname lastname FCMToken rating');

    const notifiedDrivers = [];

    for (const driver of drivers) {
      // In a real implementation, you'd check the driver's current location
      // For now, we'll notify all available drivers
      
      if (driver.FCMToken) {
        await sendNotification(
          driver.FCMToken,
          '🚗 New Special Trip Request!',
          `A passenger nearby needs a ride. Fare offered: ₱${booking.preferredFare}`,
          {
            type: 'new_booking',
            bookingId: booking._id.toString(),
            pickupLat: booking.pickup.latitude.toString(),
            pickupLon: booking.pickup.longitude.toString(),
            fare: booking.preferredFare.toString(),
          }
        );
        notifiedDrivers.push(driver);
      }
    }

    console.log(`Notified ${notifiedDrivers.length} drivers about booking ${booking._id}`);
    return notifiedDrivers;
  } catch (error) {
    console.error('Error notifying drivers:', error);
    return [];
  }
};

/**
 * Get user's bookings
 * GET /api/booking/user
 */
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const query = { user: userId };
    if (status) {
      // Support comma-separated status values for multiple status queries
      const statusArray = status.split(',').map(s => s.trim());
      if (statusArray.length > 1) {
        query.status = { $in: statusArray };
      } else {
        query.status = status;
      }
    }

    const bookings = await Booking.find(query)
      .populate('driver', 'firstname lastname rating image')
      .populate('tricycle', 'plateNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      bookings,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message,
    });
  }
};

/**
 * Get single booking details
 * GET /api/booking/:id
 */
export const getBookingDetails = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'firstname lastname rating image phone')
      .populate('driver', 'firstname lastname rating image phone')
      .populate('tricycle', 'plateNumber');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check if user is authorized to view this booking
    const isAuthorized =
      booking.user._id.toString() === req.user._id.toString() ||
      (booking.driver && booking.driver._id.toString() === req.user._id.toString()) ||
      req.user.role === 'admin' ||
      req.user.role === 'operator';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking',
      });
    }

    res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: error.message,
    });
  }
};

/**
 * Driver accepts a booking and optionally makes a counter offer
 * POST /api/booking/:id/driver-respond
 */
export const driverRespondToBooking = async (req, res) => {
  try {
    const { accept, counterOffer, message } = req.body;
    const driverId = req.user._id;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This booking is no longer available',
      });
    }

    // Check if booking has expired
    if (new Date() > booking.expiresAt) {
      booking.status = 'expired';
      await booking.save();
      return res.status(400).json({
        success: false,
        message: 'This booking has expired',
      });
    }

    if (accept && !counterOffer) {
      // Driver accepts at user's preferred fare
      booking.driver = driverId;
      booking.agreedFare = booking.preferredFare;
      booking.status = 'accepted';
      booking.acceptedAt = new Date();
    } else if (counterOffer) {
      // Driver makes a counter offer
      booking.driver = driverId;
      booking.driverOffer = {
        amount: counterOffer,
        offeredAt: new Date(),
        message: message || '',
      };
      booking.status = 'offer_made';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid response. Must accept or provide counter offer.',
      });
    }

    await booking.save();
    await booking.populate('driver', 'firstname lastname rating image');

    // Notify the user
    const user = await User.findById(booking.user);
    if (user && user.FCMToken) {
      const driver = await User.findById(driverId);
      if (counterOffer) {
        await sendNotification(
          user.FCMToken,
          '💰 Counter Offer Received!',
          `Driver ${driver.firstname} offers ₱${counterOffer} for your trip`,
          {
            type: 'driver_offer',
            bookingId: booking._id.toString(),
            offerAmount: counterOffer.toString(),
          }
        );
      } else {
        await sendNotification(
          user.FCMToken,
          '✅ Booking Accepted!',
          `Driver ${driver.firstname} accepted your booking at ₱${booking.agreedFare}`,
          {
            type: 'booking_accepted',
            bookingId: booking._id.toString(),
          }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: counterOffer ? 'Counter offer sent' : 'Booking accepted',
      booking,
    });
  } catch (error) {
    console.error('Error responding to booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to booking',
      error: error.message,
    });
  }
};

/**
 * User responds to driver's offer (accept or decline)
 * POST /api/booking/:id/respond-offer
 */
export const respondToOffer = async (req, res) => {
  try {
    const { accepted } = req.body;
    const userId = req.user._id;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    if (booking.status !== 'offer_made') {
      return res.status(400).json({
        success: false,
        message: 'No pending offer to respond to',
      });
    }

    if (accepted) {
      booking.agreedFare = booking.driverOffer.amount;
      booking.status = 'accepted';
      booking.acceptedAt = new Date();

      // Notify driver
      const driver = await User.findById(booking.driver);
      if (driver && driver.FCMToken) {
        await sendNotification(
          driver.FCMToken,
          '✅ Offer Accepted!',
          `Passenger accepted your fare of ₱${booking.agreedFare}`,
          {
            type: 'offer_accepted',
            bookingId: booking._id.toString(),
          }
        );
      }
    } else {
      // User declined - reset to pending for other drivers
      booking.driver = null;
      booking.driverOffer = { amount: null, offeredAt: null, message: '' };
      booking.status = 'pending';
      // Extend expiration
      booking.expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Notify driver
      const driver = await User.findById(booking.driver);
      if (driver && driver.FCMToken) {
        await sendNotification(
          driver.FCMToken,
          '❌ Offer Declined',
          'The passenger declined your offer',
          {
            type: 'offer_declined',
            bookingId: booking._id.toString(),
          }
        );
      }
    }

    await booking.save();
    await booking.populate('driver', 'firstname lastname rating image');

    res.status(200).json({
      success: true,
      message: accepted ? 'Offer accepted' : 'Offer declined',
      booking,
    });
  } catch (error) {
    console.error('Error responding to offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to offer',
      error: error.message,
    });
  }
};

/**
 * Start the trip (driver confirms passenger pickup)
 * POST /api/booking/:id/start-trip
 */
export const startTrip = async (req, res) => {
  try {
    const driverId = req.user._id;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Only the assigned driver can start the trip
    if (!booking.driver || booking.driver.toString() !== driverId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized - only the assigned driver can start the trip',
      });
    }

    // Can only start if status is 'accepted'
    if (booking.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: `Cannot start trip - current status is '${booking.status}'`,
      });
    }

    // Update status to in_progress
    booking.status = 'in_progress';
    booking.startedAt = new Date();

    await booking.save();

    // Notify the passenger that the trip has started
    const user = await User.findById(booking.user);
    if (user && user.FCMToken) {
      await sendNotification(
        user.FCMToken,
        '🚗 Trip Started!',
        'Your driver has confirmed pickup. Have a safe trip!',
        {
          type: 'trip_started',
          bookingId: booking._id.toString(),
        }
      );
    }

    await booking.populate('driver', 'firstname lastname rating image');
    await booking.populate('user', 'firstname lastname rating image');

    res.status(200).json({
      success: true,
      message: 'Trip started - passenger picked up',
      booking,
    });
  } catch (error) {
    console.error('Error starting trip:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start trip',
      error: error.message,
    });
  }
};

/**
 * Complete the trip (Driver marks completion, requires user confirmation)
 * POST /api/booking/:id/complete
 */
export const completeTrip = async (req, res) => {
  try {
    const { userLat, userLon, driverLat, driverLon } = req.body;
    const userId = req.user._id;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check authorization
    const isUser = booking.user.toString() === userId.toString();
    const isDriver = booking.driver && booking.driver.toString() === userId.toString();

    if (!isUser && !isDriver) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Driver completing the trip
    if (isDriver) {
      if (booking.status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          message: 'Trip must be in progress to complete',
        });
      }

      // Verify driver is near destination (within 300m)
      if (driverLat && driverLon) {
        const distance = calculateDistance(
          driverLat,
          driverLon,
          booking.destination.latitude,
          booking.destination.longitude
        );

        if (distance > 300) {
          return res.status(400).json({
            success: false,
            message: `You must be within 300m of destination to complete. Current distance: ${Math.round(distance)}m`,
          });
        }

        booking.completionLocation = { latitude: driverLat, longitude: driverLon };
      }

      // Mark driver completion and set status to awaiting user confirmation
      booking.driverConfirmedCompletion = true;
      booking.driverCompletedAt = new Date();
      booking.status = 'awaiting_confirmation';

      await booking.save();
      await booking.populate('driver', 'firstname lastname rating image');
      await booking.populate('user', 'firstname lastname rating image');

      // Notify user to confirm completion
      const user = await User.findById(booking.user);
      if (user && user.FCMToken) {
        await sendNotification(
          user.FCMToken,
          '🏁 Trip Completed by Driver',
          'Your driver has marked the trip as complete. Please confirm arrival.',
          {
            type: 'awaiting_confirmation',
            bookingId: booking._id.toString(),
          }
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Trip marked complete. Awaiting passenger confirmation.',
        booking,
      });
    }

    // User should not call this endpoint directly - use confirm-completion instead
    return res.status(400).json({
      success: false,
      message: 'Please use the confirm-completion endpoint to confirm your trip',
    });

  } catch (error) {
    console.error('Error completing trip:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete trip',
      error: error.message,
    });
  }
};

/**
 * User confirms trip completion
 * POST /api/booking/:id/confirm-completion
 */
export const confirmCompletion = async (req, res) => {
  try {
    const { confirmed, disputeReason } = req.body;
    const userId = req.user._id;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Only the user (passenger) can confirm
    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the passenger can confirm trip completion',
      });
    }

    if (booking.status !== 'awaiting_confirmation') {
      return res.status(400).json({
        success: false,
        message: 'Trip is not awaiting confirmation',
      });
    }

    if (confirmed) {
      // User confirms the trip is complete
      booking.userConfirmedCompletion = true;
      booking.status = 'completed';
      booking.completedAt = new Date();

      // Update user's trip count
      await User.findByIdAndUpdate(booking.user, { $inc: { tripCount: 1 } });
      
      // Update driver's trip count
      if (booking.driver) {
        await User.findByIdAndUpdate(booking.driver, { $inc: { tripCount: 1 } });
      }

      await booking.save();
      await booking.populate('driver', 'firstname lastname rating image');

      // Notify driver that user confirmed
      const driver = await User.findById(booking.driver);
      if (driver && driver.FCMToken) {
        await sendNotification(
          driver.FCMToken,
          '✅ Trip Confirmed!',
          'The passenger has confirmed trip completion. Great job!',
          {
            type: 'trip_completed',
            bookingId: booking._id.toString(),
          }
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Trip completed successfully',
        booking,
      });
    } else {
      // User disputes the completion
      booking.completionDisputed = true;
      booking.disputeReason = disputeReason || 'User did not confirm arrival';
      booking.disputedAt = new Date();
      // Keep status as awaiting_confirmation or change to disputed
      // For now, we'll keep it awaiting and flag it for admin review
      
      await booking.save();
      await booking.populate('driver', 'firstname lastname rating image');

      // Notify driver about the dispute
      const driver = await User.findById(booking.driver);
      if (driver && driver.FCMToken) {
        await sendNotification(
          driver.FCMToken,
          '⚠️ Completion Disputed',
          'The passenger has disputed the trip completion. An admin will review.',
          {
            type: 'completion_disputed',
            bookingId: booking._id.toString(),
          }
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Dispute submitted. An admin will review this trip.',
        booking,
      });
    }

  } catch (error) {
    console.error('Error confirming completion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm completion',
      error: error.message,
    });
  }
};

/**
 * Cancel a booking
 * POST /api/booking/:id/cancel
 */
export const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const userId = req.user._id;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check authorization
    const isUser = booking.user.toString() === userId.toString();
    const isDriver = booking.driver && booking.driver.toString() === userId.toString();

    if (!isUser && !isDriver && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Booking cannot be cancelled',
      });
    }

    booking.status = 'cancelled';
    booking.cancelledBy = isUser ? 'user' : isDriver ? 'driver' : 'system';
    booking.cancellationReason = reason || '';
    booking.cancelledAt = new Date();

    await booking.save();

    // Notify the other party
    if (isUser && booking.driver) {
      const driver = await User.findById(booking.driver);
      if (driver && driver.FCMToken) {
        await sendNotification(
          driver.FCMToken,
          '❌ Booking Cancelled',
          'The passenger cancelled the booking',
          {
            type: 'booking_cancelled',
            bookingId: booking._id.toString(),
          }
        );
      }
    } else if (isDriver) {
      const user = await User.findById(booking.user);
      if (user && user.FCMToken) {
        await sendNotification(
          user.FCMToken,
          '❌ Booking Cancelled',
          'The driver cancelled the booking',
          {
            type: 'booking_cancelled',
            bookingId: booking._id.toString(),
          }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled',
      booking,
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message,
    });
  }
};

/**
 * Rate the driver after trip completion
 * POST /api/booking/:id/rate
 */
export const rateDriver = async (req, res) => {
  try {
    const { driverId, rating, comment } = req.body;
    const userId = req.user._id;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only rate completed trips',
      });
    }

    if (booking.rating) {
      return res.status(400).json({
        success: false,
        message: 'Trip already rated',
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    // Update booking with rating
    booking.rating = rating;
    booking.ratingComment = comment || '';
    await booking.save();

    // Create a review record
    const review = new Review({
      user: userId,
      driver: driverId,
      booking: booking._id,
      rating,
      comment: comment || '',
    });
    await review.save();

    // Update driver's rating
    const driver = await User.findById(driverId);
    if (driver) {
      const totalRating = driver.rating * driver.numReviews + rating;
      driver.numReviews += 1;
      driver.rating = totalRating / driver.numReviews;
      driver.reviews.push(review._id);
      await driver.save();
    }

    res.status(200).json({
      success: true,
      message: 'Rating submitted successfully',
      booking,
    });
  } catch (error) {
    console.error('Error rating driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: error.message,
    });
  }
};

/**
 * Get nearby pending bookings (for drivers)
 * GET /api/booking/nearby
 */
export const getNearbyBookings = async (req, res) => {
  try {
    const { lat, lon, radius } = req.query;
    const driverId = req.user._id;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    const radiusKm = parseFloat(radius) || 5;
    const bookings = await Booking.findNearbyPending(
      parseFloat(lat),
      parseFloat(lon),
      radiusKm
    );

    // All pending bookings are available to all drivers
    // The notifiedDrivers array is just for tracking who was notified
    res.status(200).json({
      success: true,
      bookings: bookings,
      count: bookings.length,
    });
  } catch (error) {
    console.error('Error fetching nearby bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby bookings',
      error: error.message,
    });
  }
};

/**
 * Get user's active booking (pending, offer_made, accepted, in_progress, awaiting_confirmation)
 * GET /api/booking/active
 */
export const getActiveBooking = async (req, res) => {
  try {
    const userId = req.user._id;

    const activeBooking = await Booking.findOne({
      user: userId,
      status: { $in: ['pending', 'offer_made', 'accepted', 'in_progress', 'awaiting_confirmation'] },
    })
    .populate('driver', 'firstname lastname rating image phone')
    .populate('tricycle', 'plateNumber')
    .sort({ createdAt: -1 });

    // Check if booking has expired
    if (activeBooking && activeBooking.status === 'pending' && new Date() > activeBooking.expiresAt) {
      activeBooking.status = 'expired';
      await activeBooking.save();
      return res.status(200).json({
        success: true,
        booking: null,
        message: 'No active booking found',
      });
    }

    res.status(200).json({
      success: true,
      booking: activeBooking,
    });
  } catch (error) {
    console.error('Error fetching active booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active booking',
      error: error.message,
    });
  }
};

/**
 * Get driver's bookings
 * GET /api/booking/driver
 */
export const getDriverBookings = async (req, res) => {
  try {
    const driverId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const query = { driver: driverId };
    if (status) {
      // Support comma-separated status values for multiple status queries
      const statusArray = status.split(',').map(s => s.trim());
      if (statusArray.length > 1) {
        query.status = { $in: statusArray };
      } else {
        query.status = status;
      }
    }

    const bookings = await Booking.find(query)
      .populate('user', 'firstname lastname rating image phone')
      .populate('tricycle', 'plateNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      bookings,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching driver bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message,
    });
  }
};

/**
 * Report a booking incident (e.g., driver cancelled after accepting)
 * POST /api/booking/:id/report
 */
export const reportBooking = async (req, res) => {
  try {
    const { reason, reportType } = req.body;
    const userId = req.user._id;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check authorization - only user or driver of this booking can report
    const isUser = booking.user.toString() === userId.toString();
    const isDriver = booking.driver && booking.driver.toString() === userId.toString();

    if (!isUser && !isDriver) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to report this booking',
      });
    }

    // Add report to booking
    if (!booking.reports) {
      booking.reports = [];
    }

    booking.reports.push({
      reportedBy: userId,
      reporterRole: isUser ? 'user' : 'driver',
      reportType: reportType || 'general',
      reason: reason || '',
      reportedAt: new Date(),
    });

    await booking.save();

    // Optionally notify admins about the report
    console.log(`📋 New booking report: ${booking._id} by ${isUser ? 'user' : 'driver'} - ${reportType}: ${reason}`);

    res.status(200).json({
      success: true,
      message: 'Report submitted successfully',
    });
  } catch (error) {
    console.error('Error reporting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit report',
      error: error.message,
    });
  }
};

/**
 * Admin: Get all bookings with filters
 * GET /api/booking/admin/all
 */
export const adminGetAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      disputed,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Disputed filter
    if (disputed === 'true') {
      query.completionDisputed = true;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Search filter (search in user/driver names)
    let searchUserIds = [];
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const matchingUsers = await User.find({
        $or: [
          { firstname: searchRegex },
          { lastname: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ],
      }).select('_id');
      searchUserIds = matchingUsers.map(u => u._id);
      
      if (searchUserIds.length > 0) {
        query.$or = [
          { user: { $in: searchUserIds } },
          { driver: { $in: searchUserIds } },
        ];
      } else {
        // No matching users, return empty result
        return res.status(200).json({
          success: true,
          bookings: [],
          total: 0,
          page: parseInt(page),
          pages: 0,
          stats: await getBookingStats(),
        });
      }
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const bookings = await Booking.find(query)
      .populate('user', 'firstname lastname email phone image rating')
      .populate('driver', 'firstname lastname email phone image rating')
      .populate('tricycle', 'plateNumber')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);
    const stats = await getBookingStats();

    res.status(200).json({
      success: true,
      bookings,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      stats,
    });
  } catch (error) {
    console.error('Error fetching admin bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message,
    });
  }
};

/**
 * Helper function to get booking statistics
 */
const getBookingStats = async () => {
  try {
    const [statusCounts, todayStats, revenueStats, disputedCount] = await Promise.all([
      // Count by status
      Booking.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Today's bookings
      Booking.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Revenue stats (completed bookings)
      Booking.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$agreedFare' },
            avgFare: { $avg: '$agreedFare' },
            totalTrips: { $sum: 1 },
          },
        },
      ]),
      // Disputed bookings count
      Booking.countDocuments({ completionDisputed: true }),
    ]);

    // Format status counts
    const statusMap = {};
    statusCounts.forEach(s => {
      statusMap[s._id] = s.count;
    });

    const todayMap = {};
    todayStats.forEach(s => {
      todayMap[s._id] = s.count;
    });

    return {
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      pending: statusMap.pending || 0,
      offer_made: statusMap.offer_made || 0,
      accepted: statusMap.accepted || 0,
      in_progress: statusMap.in_progress || 0,
      awaiting_confirmation: statusMap.awaiting_confirmation || 0,
      completed: statusMap.completed || 0,
      cancelled: statusMap.cancelled || 0,
      expired: statusMap.expired || 0,
      disputed: disputedCount || 0,
      todayTotal: Object.values(todayMap).reduce((a, b) => a + b, 0),
      todayCompleted: todayMap.completed || 0,
      totalRevenue: revenueStats[0]?.totalRevenue || 0,
      avgFare: revenueStats[0]?.avgFare || 0,
    };
  } catch (error) {
    console.error('Error getting booking stats:', error);
    return null;
  }
};

/**
 * Admin: Get single booking details
 * GET /api/booking/admin/:id
 */
export const adminGetBookingDetails = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'firstname lastname email phone image rating createdAt')
      .populate('driver', 'firstname lastname email phone image rating createdAt')
      .populate('tricycle', 'plateNumber model color');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details',
      error: error.message,
    });
  }
};

/**
 * Admin: Get booking statistics
 * GET /api/booking/admin/stats
 */
export const adminGetBookingStats = async (req, res) => {
  try {
    const stats = await getBookingStats();

    // Get revenue by day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyRevenue = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          completedAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
          },
          revenue: { $sum: '$agreedFare' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      stats,
      dailyRevenue,
    });
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message,
    });
  }
};


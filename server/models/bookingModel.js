import mongoose from 'mongoose';

/**
 * Booking Model - Special Trip Bookings
 * 
 * Handles special trip requests between users and drivers
 */

const locationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  address: {
    type: String,
    required: false,
  },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  // User who requested the booking
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // Driver assigned to the booking (null until accepted)
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  
  // Tricycle used for the trip
  tricycle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tricycle',
    default: null,
  },
  
  // Pickup location
  pickup: {
    type: locationSchema,
    required: true,
  },
  
  // Destination location
  destination: {
    type: locationSchema,
    required: true,
  },
  
  // User's location when booking was made
  userLocationAtBooking: {
    type: locationSchema,
    required: false,
  },
  
  // Fare information
  preferredFare: {
    type: Number,
    required: true,
    min: [0, 'Fare cannot be negative'],
  },
  
  // Driver's counter offer (kept for backward compatibility - stores the accepted offer)
  driverOffer: {
    amount: {
      type: Number,
      default: null,
    },
    offeredAt: {
      type: Date,
      default: null,
    },
    message: {
      type: String,
      default: '',
    },
  },
  
  // Multiple driver offers (new feature)
  driverOffers: [{
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tricycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tricycle',
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Offer amount cannot be negative'],
    },
    message: {
      type: String,
      default: '',
    },
    offeredAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'withdrawn'],
      default: 'pending',
    },
  }],
  
  // Final agreed fare
  agreedFare: {
    type: Number,
    default: null,
  },
  
  // Booking status
  status: {
    type: String,
    enum: [
      'pending',        // Waiting for driver to accept
      'offer_made',     // Driver made a counter offer
      'accepted',       // User accepted, trip is active
      'in_progress',    // Trip has started
      'awaiting_confirmation', // Driver marked complete, waiting for user confirmation
      'completed',      // Trip completed successfully
      'cancelled',      // Booking was cancelled
      'expired',        // No driver accepted in time
      'no_show',        // Passenger did not show up
    ],
    default: 'pending',
  },
  
  // Who cancelled the booking (if cancelled)
  cancelledBy: {
    type: String,
    enum: ['user', 'driver', 'system', null],
    default: null,
  },
  
  // Cancellation reason
  cancellationReason: {
    type: String,
    default: '',
  },
  
  // Rating given by user (1-5 stars)
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null,
  },
  
  // User's review comment
  ratingComment: {
    type: String,
    default: '',
  },
  
  // Timestamps for various stages
  acceptedAt: {
    type: Date,
    default: null,
  },
  
  startedAt: {
    type: Date,
    default: null,
  },
  
  // When driver marked the trip as complete
  driverCompletedAt: {
    type: Date,
    default: null,
  },
  
  completedAt: {
    type: Date,
    default: null,
  },
  
  cancelledAt: {
    type: Date,
    default: null,
  },
  
  // No-show related fields
  driverArrivedAt: {
    type: Date,
    default: null,
    description: 'When driver arrived at pickup location',
  },
  
  noShowMarkedAt: {
    type: Date,
    default: null,
  },
  
  noShowFee: {
    type: Number,
    default: null,
    description: 'Fee charged for no-show (typically 50% of fare)',
  },
  
  noShowWaitMinutes: {
    type: Number,
    default: 5,
    description: 'Minutes driver waited before marking no-show',
  },
  
  // Completion dispute fields
  completionDisputed: {
    type: Boolean,
    default: false,
  },
  
  disputeReason: {
    type: String,
    default: '',
  },
  
  disputedAt: {
    type: Date,
    default: null,
  },
  
  // Estimated distance in meters
  estimatedDistance: {
    type: Number,
    default: null,
  },
  
  // Actual distance traveled in meters
  actualDistance: {
    type: Number,
    default: null,
  },
  
  // Notified drivers (array of driver IDs who were notified)
  notifiedDrivers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  
  // Expiration time for the booking request
  expiresAt: {
    type: Date,
    default: function() {
      // Default expiration: 30 minutes from creation
      return new Date(Date.now() + 30 * 60 * 1000);
    },
  },
  
  // Completion verification
  userConfirmedCompletion: {
    type: Boolean,
    default: false,
  },
  
  driverConfirmedCompletion: {
    type: Boolean,
    default: false,
  },
  
  // Driver's current live location (updated during active trips)
  driverCurrentLocation: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    updatedAt: { type: Date, default: null },
  },

  // Location at completion (for verification)
  completionLocation: {
    type: locationSchema,
    default: null,
  },
  
  // Reports filed against this booking
  reports: [{
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reporterRole: {
      type: String,
      enum: ['user', 'driver'],
    },
    reportType: {
      type: String,
      enum: ['driver_cancelled', 'user_cancelled', 'inappropriate_behavior', 'fare_dispute', 'general'],
      default: 'general',
    },
    reason: {
      type: String,
      default: '',
    },
    reportedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
    },
  }],
  
}, { timestamps: true });

// Indexes for efficient queries
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ driver: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ expiresAt: 1 });
bookingSchema.index({ 'pickup.latitude': 1, 'pickup.longitude': 1 });

// Virtual for calculating if booking is expired
bookingSchema.virtual('isExpired').get(function() {
  return this.status === 'pending' && new Date() > this.expiresAt;
});

// Method to check if user is near destination
bookingSchema.methods.isNearDestination = function(currentLat, currentLon, radiusMeters = 300) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (currentLat * Math.PI) / 180;
  const φ2 = (this.destination.latitude * Math.PI) / 180;
  const Δφ = ((this.destination.latitude - currentLat) * Math.PI) / 180;
  const Δλ = ((this.destination.longitude - currentLon) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance <= radiusMeters;
};

// Static method to find nearby pending bookings for drivers
bookingSchema.statics.findNearbyPending = async function(lat, lon, radiusKm = 5) {
  const earthRadiusKm = 6371;
  
  // Calculate bounding box for initial filtering
  const latDelta = radiusKm / earthRadiusKm * (180 / Math.PI);
  const lonDelta = radiusKm / earthRadiusKm * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
  
  return this.find({
    status: 'pending',
    expiresAt: { $gt: new Date() },
    'pickup.latitude': { $gte: lat - latDelta, $lte: lat + latDelta },
    'pickup.longitude': { $gte: lon - lonDelta, $lte: lon + lonDelta },
  })
  .populate('user', 'firstname lastname rating image')
  .sort({ createdAt: -1 });
};

// Pre-save middleware to calculate estimated distance
bookingSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('pickup') || this.isModified('destination')) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (this.pickup.latitude * Math.PI) / 180;
    const φ2 = (this.destination.latitude * Math.PI) / 180;
    const Δφ = ((this.destination.latitude - this.pickup.latitude) * Math.PI) / 180;
    const Δλ = ((this.destination.longitude - this.pickup.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    this.estimatedDistance = Math.round(R * c);
  }
  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;

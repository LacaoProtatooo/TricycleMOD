import mongoose from 'mongoose';

const userActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    deviceInfo: {
      platform: { type: String, default: 'unknown' }, // 'mobile', 'web', 'unknown'
      deviceType: { type: String, default: '' },
      appVersion: { type: String, default: '' },
    },
    socketId: {
      type: String,
      default: null,
    },
    // Current GPS location for live tracking
    currentLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      altitude: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 },
      speed: { type: Number, default: 0 },
      heading: { type: Number, default: 0 },
      timestamp: { type: Date, default: null },
    },
    hasLocation: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
userActivitySchema.index({ userId: 1 });
userActivitySchema.index({ isOnline: 1 });
userActivitySchema.index({ lastSeen: -1 });
userActivitySchema.index({ isOnline: 1, hasLocation: 1 }); // For live tracking queries

// Static method to update user activity (heartbeat) with optional location
userActivitySchema.statics.updateActivity = async function (userId, deviceInfo = {}, location = null) {
  const now = new Date();
  
  const updateObj = {
    isOnline: true,
    lastSeen: now,
    lastActiveAt: now,
    ...(deviceInfo.platform && { 'deviceInfo.platform': deviceInfo.platform }),
    ...(deviceInfo.deviceType && { 'deviceInfo.deviceType': deviceInfo.deviceType }),
    ...(deviceInfo.appVersion && { 'deviceInfo.appVersion': deviceInfo.appVersion }),
  };

  // Update location if provided
  if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
    updateObj['currentLocation.latitude'] = location.latitude;
    updateObj['currentLocation.longitude'] = location.longitude;
    updateObj['currentLocation.altitude'] = location.altitude || 0;
    updateObj['currentLocation.accuracy'] = location.accuracy || 0;
    updateObj['currentLocation.speed'] = location.speed || 0;
    updateObj['currentLocation.heading'] = location.heading || 0;
    updateObj['currentLocation.timestamp'] = location.timestamp ? new Date(location.timestamp) : now;
    updateObj.hasLocation = true;
  }

  return this.findOneAndUpdate(
    { userId },
    { $set: updateObj },
    { upsert: true, new: true }
  );
};

// Static method to mark user as offline
userActivitySchema.statics.setOffline = async function (userId) {
  return this.findOneAndUpdate(
    { userId },
    {
      $set: {
        isOnline: false,
        lastSeen: new Date(),
      },
    },
    { new: true }
  );
};

// Static method to mark inactive users as offline (called periodically)
// Users inactive for more than 5 minutes are considered offline
userActivitySchema.statics.markInactiveUsersOffline = async function (inactiveThresholdMs = 5 * 60 * 1000) {
  const threshold = new Date(Date.now() - inactiveThresholdMs);
  return this.updateMany(
    {
      isOnline: true,
      lastActiveAt: { $lt: threshold },
    },
    {
      $set: { isOnline: false },
    }
  );
};

const UserActivity = mongoose.model('UserActivity', userActivitySchema);

export default UserActivity;

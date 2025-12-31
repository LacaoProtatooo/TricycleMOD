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
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
userActivitySchema.index({ userId: 1 });
userActivitySchema.index({ isOnline: 1 });
userActivitySchema.index({ lastSeen: -1 });

// Static method to update user activity (heartbeat)
userActivitySchema.statics.updateActivity = async function (userId, deviceInfo = {}) {
  const now = new Date();
  return this.findOneAndUpdate(
    { userId },
    {
      $set: {
        isOnline: true,
        lastSeen: now,
        lastActiveAt: now,
        ...(deviceInfo.platform && { 'deviceInfo.platform': deviceInfo.platform }),
        ...(deviceInfo.deviceType && { 'deviceInfo.deviceType': deviceInfo.deviceType }),
        ...(deviceInfo.appVersion && { 'deviceInfo.appVersion': deviceInfo.appVersion }),
      },
    },
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

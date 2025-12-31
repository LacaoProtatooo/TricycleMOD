import mongoose from 'mongoose';

const adminNotificationReadSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      required: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate reads
adminNotificationReadSchema.index({ notificationId: 1, adminId: 1 }, { unique: true });

const AdminNotificationRead = mongoose.model('AdminNotificationRead', adminNotificationReadSchema);

export default AdminNotificationRead;

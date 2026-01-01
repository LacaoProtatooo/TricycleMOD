import mongoose from 'mongoose';

const adminActivityLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  adminEmail: {
    type: String,
    required: true,
  },
  adminName: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'ROLE_CHANGE',
      'USER_VERIFY',
      'USER_DELETE',
      'USER_UPDATE',
      'ANNOUNCEMENT_CREATE',
      'ANNOUNCEMENT_UPDATE',
      'ANNOUNCEMENT_DELETE',
      'BOOKING_UPDATE',
      'BOOKING_CANCEL',
      'NOTIFICATION_SEND',
      'SETTINGS_UPDATE',
      'OTHER'
    ],
  },
  description: {
    type: String,
    required: true,
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  targetUserEmail: {
    type: String,
  },
  targetUserName: {
    type: String,
  },
  previousValue: {
    type: mongoose.Schema.Types.Mixed,
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
  },
  confirmationCode: {
    type: String,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
adminActivityLogSchema.index({ adminId: 1, createdAt: -1 });
adminActivityLogSchema.index({ action: 1, createdAt: -1 });
adminActivityLogSchema.index({ targetUserId: 1, createdAt: -1 });
adminActivityLogSchema.index({ createdAt: -1 });

// Static method to log admin activity
adminActivityLogSchema.statics.logActivity = async function(activityData) {
  try {
    const log = new this(activityData);
    await log.save();
    return log;
  } catch (error) {
    console.error('Error logging admin activity:', error);
    throw error;
  }
};

// Static method to get activity logs with pagination
adminActivityLogSchema.statics.getActivityLogs = async function(options = {}) {
  const {
    page = 1,
    limit = 20,
    adminId,
    action,
    startDate,
    endDate,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const query = {};

  if (adminId) {
    query.adminId = adminId;
  }

  if (action && action !== 'all') {
    query.action = action;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { adminEmail: { $regex: search, $options: 'i' } },
      { adminName: { $regex: search, $options: 'i' } },
      { targetUserEmail: { $regex: search, $options: 'i' } },
      { targetUserName: { $regex: search, $options: 'i' } },
    ];
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const total = await this.countDocuments(query);
  const totalPages = Math.ceil(total / limit);

  const logs = await this.find(query)
    .sort(sortOptions)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    logs,
    pagination: {
      currentPage: page,
      totalPages,
      totalLogs: total,
      limit,
    },
  };
};

const AdminActivityLog = mongoose.model('AdminActivityLog', adminActivityLogSchema);

export default AdminActivityLog;

import Booking from '../models/bookingModel.js';
import Announcement from '../models/announcementModel.js';
import Complaint from '../models/complaintModel.js';
import AdminNotificationRead from '../models/adminNotificationModel.js';

/**
 * Get admin notifications
 * - Booking disputes
 * - Announcements expiring within 1 day
 * - New complaints
 */
export const getAdminNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type = '', showRead = 'true' } = req.query;
    const adminId = req.user._id;
    const notifications = [];

    // Get read notification IDs for this admin
    const readNotifications = await AdminNotificationRead.find({ adminId }).select('notificationId');
    const readIds = new Set(readNotifications.map(r => r.notificationId));

    // Get disputed bookings
    if (!type || type === 'dispute') {
      const disputedBookings = await Booking.find({ completionDisputed: true })
        .populate('user', 'firstname lastname email phone image')
        .populate('driver', 'firstname lastname email phone image')
        .sort({ disputedAt: -1 })
        .limit(50);

      disputedBookings.forEach(booking => {
        const notificationId = `dispute_${booking._id}`;
        const isRead = readIds.has(notificationId);
        
        // Skip read notifications if showRead is false
        if (showRead === 'false' && isRead) return;
        
        notifications.push({
          _id: notificationId,
          type: 'dispute',
          title: 'Booking Dispute',
          message: `${booking.user?.firstname || 'User'} ${booking.user?.lastname || ''} has disputed a completed booking`,
          reason: booking.disputeReason || 'No reason provided',
          booking: {
            _id: booking._id,
            fare: booking.agreedFare || booking.preferredFare,
            status: booking.status,
            passenger: booking.user,
            disputeReason: booking.disputeReason,
            updatedAt: booking.updatedAt,
          },
          user: booking.user,
          driver: booking.driver,
          createdAt: booking.disputedAt || booking.updatedAt,
          isRead,
        });
      });
    }

    // Get pending/investigating complaints
    if (!type || type === 'complaint') {
      const pendingComplaints = await Complaint.find({ 
        status: { $in: ['pending', 'under_review', 'investigating'] }
      })
        .populate('complainant', 'firstname lastname email phone image')
        .populate('driver', 'firstname lastname email phone image')
        .sort({ createdAt: -1 })
        .limit(50);

      pendingComplaints.forEach(complaint => {
        const notificationId = `complaint_${complaint._id}`;
        const isRead = readIds.has(notificationId);
        
        // Skip read notifications if showRead is false
        if (showRead === 'false' && isRead) return;
        
        const categoryLabels = {
          rude_behavior: 'Rude Behavior',
          overcharging: 'Overcharging',
          unsafe_driving: 'Unsafe Driving',
          route_deviation: 'Route Deviation',
          vehicle_condition: 'Vehicle Condition',
          refusal_of_service: 'Refusal of Service',
          harassment: 'Harassment',
          discrimination: 'Discrimination',
          intoxicated_driving: 'Intoxicated Driving',
          other: 'Other',
        };
        
        notifications.push({
          _id: notificationId,
          type: 'complaint',
          title: `Driver Complaint: ${categoryLabels[complaint.category] || complaint.category}`,
          message: `${complaint.complainant?.firstname || 'User'} filed a complaint against ${complaint.driver?.firstname || 'Driver'} ${complaint.driver?.lastname || ''}`,
          complaint: {
            _id: complaint._id,
            category: complaint.category,
            categoryLabel: categoryLabels[complaint.category] || complaint.category,
            status: complaint.status,
            description: complaint.description,
            credibilityScore: complaint.credibilityScore,
            evidenceCount: complaint.evidence?.length || 0,
          },
          complainant: complaint.complainant,
          driver: complaint.driver,
          createdAt: complaint.createdAt,
          isRead,
          priority: complaint.credibilityScore >= 70 ? 'high' : complaint.credibilityScore >= 40 ? 'medium' : 'low',
        });
      });
    }

    // Get announcements expiring within 1 day
    if (!type || type === 'expiring') {
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const expiringAnnouncements = await Announcement.find({
        isActive: true,
        expiryDate: { $ne: null, $lte: oneDayFromNow, $gt: now }
      })
        .populate('createdBy', 'firstname lastname')
        .sort({ expiryDate: 1 });

      expiringAnnouncements.forEach(announcement => {
        const notificationId = `expiring_${announcement._id}`;
        const isRead = readIds.has(notificationId);
        
        // Skip read notifications if showRead is false
        if (showRead === 'false' && isRead) return;
        
        const hoursLeft = Math.round((new Date(announcement.expiryDate) - now) / (1000 * 60 * 60));
        notifications.push({
          _id: notificationId,
          type: 'expiring',
          title: 'Announcement Expiring Soon',
          message: `"${announcement.title}" will expire in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`,
          announcement: {
            _id: announcement._id,
            title: announcement.title,
            endDate: announcement.expiryDate,
            expiryDate: announcement.expiryDate,
            type: announcement.type,
          },
          createdBy: announcement.createdBy,
          createdAt: announcement.updatedAt,
          isRead,
        });
      });
    }

    // Sort all notifications by date (most recent first)
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedNotifications = notifications.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      notifications: paginatedNotifications,
      total: notifications.length,
      page: parseInt(page),
      pages: Math.ceil(notifications.length / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching admin notifications:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch notifications', 
      error: error.message 
    });
  }
};

/**
 * Get admin notification counts
 */
export const getAdminNotificationCounts = async (req, res) => {
  try {
    const adminId = req.user._id;
    
    // Get read notification IDs for this admin
    const readNotifications = await AdminNotificationRead.find({ adminId }).select('notificationId');
    const readIds = new Set(readNotifications.map(r => r.notificationId));

    // Count disputed bookings (unread only)
    const disputedBookings = await Booking.find({ completionDisputed: true }).select('_id');
    let disputeCount = 0;
    disputedBookings.forEach(b => {
      if (!readIds.has(`dispute_${b._id}`)) disputeCount++;
    });

    // Count announcements expiring within 1 day (unread only)
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const expiringAnnouncements = await Announcement.find({
      isActive: true,
      expiryDate: { $ne: null, $lte: oneDayFromNow, $gt: now }
    }).select('_id');
    
    let expiringCount = 0;
    expiringAnnouncements.forEach(a => {
      if (!readIds.has(`expiring_${a._id}`)) expiringCount++;
    });

    // Count pending complaints (unread only)
    const pendingComplaints = await Complaint.find({ 
      status: { $in: ['pending', 'under_review', 'investigating'] }
    }).select('_id');
    
    let complaintCount = 0;
    pendingComplaints.forEach(c => {
      if (!readIds.has(`complaint_${c._id}`)) complaintCount++;
    });

    res.status(200).json({
      success: true,
      counts: {
        disputes: disputeCount,
        expiring: expiringCount,
        complaints: complaintCount,
        total: disputeCount + expiringCount + complaintCount,
      }
    });
  } catch (error) {
    console.error('Error fetching notification counts:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch notification counts', 
      error: error.message 
    });
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const adminId = req.user._id;

    // Check if already read
    const existing = await AdminNotificationRead.findOne({ notificationId, adminId });
    
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Notification already marked as read',
      });
    }

    // Create read record
    await AdminNotificationRead.create({
      notificationId,
      adminId,
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Error marking notification as read:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to mark notification as read', 
      error: error.message 
    });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const adminId = req.user._id;
    const notificationIds = [];

    // Get all current notification IDs
    const disputedBookings = await Booking.find({ completionDisputed: true }).select('_id');
    disputedBookings.forEach(b => notificationIds.push(`dispute_${b._id}`));

    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const expiringAnnouncements = await Announcement.find({
      isActive: true,
      expiryDate: { $ne: null, $lte: oneDayFromNow, $gt: now }
    }).select('_id');
    expiringAnnouncements.forEach(a => notificationIds.push(`expiring_${a._id}`));

    // Get pending complaints
    const pendingComplaints = await Complaint.find({ 
      status: { $in: ['pending', 'under_review', 'investigating'] }
    }).select('_id');
    pendingComplaints.forEach(c => notificationIds.push(`complaint_${c._id}`));

    // Mark all as read (using upsert to avoid duplicates)
    const bulkOps = notificationIds.map(notificationId => ({
      updateOne: {
        filter: { notificationId, adminId },
        update: { $setOnInsert: { notificationId, adminId, readAt: new Date() } },
        upsert: true,
      }
    }));

    if (bulkOps.length > 0) {
      await AdminNotificationRead.bulkWrite(bulkOps);
    }

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      count: notificationIds.length,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to mark all notifications as read', 
      error: error.message 
    });
  }
};

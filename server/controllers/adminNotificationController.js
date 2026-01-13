import Booking from '../models/bookingModel.js';
import Announcement from '../models/announcementModel.js';
import Complaint from '../models/complaintModel.js';
import LostFound from '../models/lostFoundModel.js';
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

    // Get new lost & found items (posted within last 7 days)
    if (!type || type === 'lostfound') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const lostFoundItems = await LostFound.find({
        createdAt: { $gte: sevenDaysAgo }
      })
        .populate('driver', 'firstname lastname email image')
        .sort({ createdAt: -1 })
        .limit(30);

      lostFoundItems.forEach(item => {
        const notificationId = `lostfound_${item._id}`;
        const isRead = readIds.has(notificationId);
        
        // Skip read notifications if showRead is false
        if (showRead === 'false' && isRead) return;

        const statusLabels = {
          posted: 'New Item Posted',
          claimed: 'Item Claimed',
          returned: 'Item Returned',
        };

        notifications.push({
          _id: notificationId,
          type: 'lostfound',
          title: statusLabels[item.status] || 'Lost & Found Update',
          message: item.status === 'posted' 
            ? `${item.driver?.firstname || 'Driver'} found: "${item.title}"`
            : `"${item.title}" has been ${item.status}`,
          lostFound: {
            _id: item._id,
            title: item.title,
            description: item.description,
            status: item.status,
            locationText: item.locationText,
            photoUrl: item.photoUrl,
          },
          driver: item.driver,
          createdAt: item.status === 'posted' ? item.createdAt : (item.claimedAt || item.updatedAt),
          isRead,
          priority: item.status === 'posted' ? 'low' : 'medium',
        });
      });
    }

    // Get recently resolved/dismissed complaints (within last 7 days)
    if (!type || type === 'resolved') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const resolvedComplaints = await Complaint.find({
        status: { $in: ['resolved', 'dismissed'] },
        resolvedAt: { $gte: sevenDaysAgo }
      })
        .populate('complainant', 'firstname lastname email image')
        .populate('driver', 'firstname lastname email image')
        .populate('resolvedBy', 'firstname lastname')
        .sort({ resolvedAt: -1 })
        .limit(30);

      resolvedComplaints.forEach(complaint => {
        const notificationId = `resolved_${complaint._id}`;
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
          type: 'resolved',
          title: `Complaint ${complaint.status === 'resolved' ? 'Resolved' : 'Dismissed'}`,
          message: `${categoryLabels[complaint.category] || complaint.category} complaint against ${complaint.driver?.firstname || 'Driver'} ${complaint.driver?.lastname || ''} was ${complaint.status}`,
          complaint: {
            _id: complaint._id,
            category: complaint.category,
            categoryLabel: categoryLabels[complaint.category] || complaint.category,
            status: complaint.status,
            resolution: complaint.resolution,
            actionTaken: complaint.actionTaken,
          },
          complainant: complaint.complainant,
          driver: complaint.driver,
          resolvedBy: complaint.resolvedBy,
          createdAt: complaint.resolvedAt || complaint.updatedAt,
          isRead,
          priority: complaint.actionTaken ? 'high' : 'medium',
        });
      });
    }

    // Get driver violations (complaints with action taken within last 30 days)
    if (!type || type === 'violation') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const violationComplaints = await Complaint.find({
        actionTaken: { $exists: true, $ne: null },
        resolvedAt: { $gte: thirtyDaysAgo }
      })
        .populate('driver', 'firstname lastname email image isSuspended suspendedUntil')
        .populate('resolvedBy', 'firstname lastname')
        .sort({ resolvedAt: -1 })
        .limit(20);

      violationComplaints.forEach(complaint => {
        const notificationId = `violation_${complaint._id}`;
        const isRead = readIds.has(notificationId);
        
        // Skip read notifications if showRead is false
        if (showRead === 'false' && isRead) return;

        const actionLabels = {
          warning: '⚠️ Warning Issued',
          suspension_1day: '🚫 1-Day Suspension',
          suspension_3day: '🚫 3-Day Suspension',
          suspension_7day: '🚫 7-Day Suspension',
          suspension_30day: '🔴 30-Day Suspension',
          termination: '❌ Termination',
        };

        notifications.push({
          _id: notificationId,
          type: 'violation',
          title: actionLabels[complaint.actionTaken] || 'Driver Violation',
          message: `${complaint.driver?.firstname || 'Driver'} ${complaint.driver?.lastname || ''} received ${actionLabels[complaint.actionTaken] || complaint.actionTaken} for ${complaint.category}`,
          complaint: {
            _id: complaint._id,
            category: complaint.category,
            actionTaken: complaint.actionTaken,
            resolution: complaint.resolution,
          },
          driver: complaint.driver,
          resolvedBy: complaint.resolvedBy,
          createdAt: complaint.resolvedAt || complaint.updatedAt,
          isRead,
          priority: complaint.actionTaken?.includes('suspension') || complaint.actionTaken === 'termination' ? 'high' : 'medium',
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

    // Count new lost & found items (within 7 days, unread only)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lostFoundItems = await LostFound.find({
      createdAt: { $gte: sevenDaysAgo }
    }).select('_id');
    
    let lostFoundCount = 0;
    lostFoundItems.forEach(item => {
      if (!readIds.has(`lostfound_${item._id}`)) lostFoundCount++;
    });

    // Count resolved complaints (within 7 days, unread only)
    const resolvedComplaints = await Complaint.find({
      status: { $in: ['resolved', 'dismissed'] },
      resolvedAt: { $gte: sevenDaysAgo }
    }).select('_id');
    
    let resolvedCount = 0;
    resolvedComplaints.forEach(c => {
      if (!readIds.has(`resolved_${c._id}`)) resolvedCount++;
    });

    // Count violations (within 30 days, unread only)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const violationComplaints = await Complaint.find({
      actionTaken: { $exists: true, $ne: null },
      resolvedAt: { $gte: thirtyDaysAgo }
    }).select('_id');
    
    let violationCount = 0;
    violationComplaints.forEach(c => {
      if (!readIds.has(`violation_${c._id}`)) violationCount++;
    });

    res.status(200).json({
      success: true,
      counts: {
        disputes: disputeCount,
        expiring: expiringCount,
        complaints: complaintCount,
        lostFound: lostFoundCount,
        resolved: resolvedCount,
        violations: violationCount,
        total: disputeCount + expiringCount + complaintCount + lostFoundCount + resolvedCount + violationCount,
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

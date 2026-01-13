// server/controllers/announcementController.js
import Announcement from '../models/announcementModel.js';
import User from '../models/userModel.js';
import { messaging } from '../utils/firebase.js';
import cloudinary from '../utils/cloudinaryConfig.js';

// Helper function to send push notifications to users
const sendAnnouncementNotifications = async (announcement, targetAudience) => {
  try {
    // Check if messaging is available
    if (!messaging) {
      console.error('❌ Firebase messaging is not initialized. Push notifications disabled.');
      return { success: false, error: 'Firebase messaging not initialized' };
    }

    // Build query based on target audience
    let userQuery = { FCMToken: { $exists: true, $ne: null, $ne: '' } };
    
    if (targetAudience !== 'all') {
      userQuery.role = targetAudience;
    }

    // Get all users with FCM tokens matching the target audience
    const users = await User.find(userQuery).select('FCMToken role');
    
    if (users.length === 0) {
      console.log('⚠️ No users with FCM tokens found for target audience:', targetAudience);
      return { success: true, sent: 0 };
    }

    console.log(`📢 Sending announcement to ${users.length} users (target: ${targetAudience})`);

    // Get notification icon/color based on type
    const getTypeConfig = (type) => {
      switch (type) {
        case 'urgent':
          return { icon: 'alert-circle', color: '#EF4444' };
        case 'warning':
          return { icon: 'warning', color: '#F59E0B' };
        case 'maintenance':
          return { icon: 'build', color: '#10B981' };
        default:
          return { icon: 'information-circle', color: '#3B82F6' };
      }
    };

    const typeConfig = getTypeConfig(announcement.type);
    let successCount = 0;
    let failCount = 0;

    console.log(`📢 Processing ${users.length} users for notification...`);

    // Send notifications in batches to avoid overloading
    for (const user of users) {
      try {
        console.log(`📢 Sending to user ${user._id}, token: ${user.FCMToken?.substring(0, 20)}...`);
        
        const notificationPayload = {
          token: user.FCMToken,
          notification: {
            title: announcement.title,
            body: announcement.message.substring(0, 200) + (announcement.message.length > 200 ? '...' : ''),
          },
          data: {
            type: 'announcement',
            announcementId: announcement._id.toString(),
            announcementType: announcement.type,
            targetAudience: announcement.targetAudience,
            click_action: 'OPEN_NOTIFICATIONS',
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'announcements',
              sound: 'default',
              priority: 'high',
              color: typeConfig.color,
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                'content-available': 1,
              },
            },
          },
        };

        const messageId = await messaging.send(notificationPayload);
        console.log(`✅ Notification sent successfully, messageId: ${messageId}`);
        successCount++;
      } catch (notifError) {
        failCount++;
        console.error(`❌ Notification error for user ${user._id}:`, notifError.code, notifError.message);
        // If token is invalid, we might want to remove it from the user
        if (notifError.code === 'messaging/registration-token-not-registered' ||
            notifError.code === 'messaging/invalid-registration-token') {
          console.log(`⚠️ Invalid FCM token for user, clearing token`);
          await User.findByIdAndUpdate(user._id, { FCMToken: null });
        } else {
          console.error('❌ Failed to send notification to user:', notifError.message);
        }
      }
    }

    console.log(`✅ Announcement notifications sent: ${successCount} success, ${failCount} failed`);
    return { success: true, sent: successCount, failed: failCount };
  } catch (error) {
    console.error('❌ Error sending announcement notifications:', error);
    return { success: false, error: error.message };
  }
};

// Create new announcement (admin/operator only)
export const createAnnouncement = async (req, res) => {
  try {
    const { title, message, scheduledDate, expiryDate, type, targetAudience, isActive, image } = req.body;
    
    const now = new Date();
    
    console.log('📢 [createAnnouncement] Creating announcement:', {
      title,
      type,
      targetAudience,
      scheduledDate,
      expiryDate,
      isActive,
      hasImage: !!image,
      serverTime: now.toISOString(),
    });

    // Handle image upload to Cloudinary if provided (base64)
    let imageData = null;
    if (image) {
      try {
        console.log('📢 [createAnnouncement] Uploading image to Cloudinary...');
        const uploadResult = await cloudinary.uploader.upload(image, {
          folder: 'announcements',
          resource_type: 'image',
          transformation: [
            { width: 1200, height: 630, crop: 'limit' },
            { quality: 'auto:good' },
          ],
        });
        imageData = {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url,
        };
        console.log('📢 [createAnnouncement] Image uploaded:', imageData.url);
      } catch (uploadError) {
        console.error('📢 [createAnnouncement] Image upload failed:', uploadError.message);
        // Continue without image if upload fails
      }
    }

    // If scheduledDate is provided as a date string (YYYY-MM-DD), 
    // and it's today or earlier, use current time for immediate delivery
    let effectiveScheduledDate;
    if (scheduledDate) {
      const inputDate = new Date(scheduledDate);
      // Get start of today (UTC)
      const startOfToday = new Date(now);
      startOfToday.setUTCHours(0, 0, 0, 0);
      
      // If scheduled date is today or in the past, use current time for immediate visibility
      if (inputDate <= startOfToday || inputDate <= now) {
        effectiveScheduledDate = now;
        console.log('📢 [createAnnouncement] Scheduled date is today or past, using current time for immediate delivery');
      } else {
        effectiveScheduledDate = inputDate;
      }
    } else {
      effectiveScheduledDate = now;
    }
    
    console.log('📢 [createAnnouncement] Effective scheduled date:', effectiveScheduledDate.toISOString());
    
    const announcement = await Announcement.create({
      title,
      message,
      image: imageData,
      scheduledDate: effectiveScheduledDate,
      expiryDate: expiryDate || null,
      type: type || 'info',
      targetAudience: targetAudience || 'all',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    });

    console.log('📢 [createAnnouncement] Announcement created:', announcement._id);

    // Send push notifications if announcement is active and scheduled for now or past
    const shouldNotify = announcement.isActive && 
      (new Date(announcement.scheduledDate) <= now);
    
    console.log('📢 [createAnnouncement] Should notify:', shouldNotify, {
      isActive: announcement.isActive,
      scheduledDate: announcement.scheduledDate,
      now: now.toISOString(),
      comparison: `${new Date(announcement.scheduledDate).toISOString()} <= ${now.toISOString()}`,
    });

    let notificationResult = null;
    if (shouldNotify) {
      notificationResult = await sendAnnouncementNotifications(announcement, announcement.targetAudience);
    }

    // Log admin activity for announcement creation
    if (req.user.role === 'admin') {
      const AdminActivityLog = (await import('../models/adminActivityLogModel.js')).default;
      await AdminActivityLog.logActivity({
        adminId: req.user._id,
        adminEmail: req.user.email,
        adminName: `${req.user.firstname || ''} ${req.user.lastname || ''}`.trim() || 'Admin',
        action: 'ANNOUNCEMENT_CREATE',
        description: `Created announcement: "${announcement.title}" (${announcement.type}) targeting ${announcement.targetAudience}`,
        newValue: {
          title: announcement.title,
          type: announcement.type,
          targetAudience: announcement.targetAudience,
          scheduledDate: announcement.scheduledDate,
          expiryDate: announcement.expiryDate,
        },
        metadata: {
          announcementId: announcement._id,
          hasImage: !!imageData,
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
      });
    }

    res.status(201).json({
      success: true,
      announcement,
      notificationsSent: notificationResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get active announcements for user
export const getActiveAnnouncements = async (req, res) => {
  try {
    const userRole = req.user.role;
    const now = new Date();
    
    // Use start of tomorrow UTC for timezone buffer
    const comparisonDate = new Date(now);
    comparisonDate.setUTCDate(comparisonDate.getUTCDate() + 1);
    comparisonDate.setUTCHours(0, 0, 0, 0);

    console.log('📢 [getActiveAnnouncements] User role:', userRole);

    const announcements = await Announcement.find({
      isActive: true,
      scheduledDate: { $lte: comparisonDate },
      $and: [
        {
          $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: null },
            { expiryDate: { $gte: now } },
          ],
        },
        {
          $or: [
            { targetAudience: 'all' },
            { targetAudience: userRole },
          ],
        },
      ],
    })
    .sort({ scheduledDate: -1 })
    .populate('createdBy', 'username firstname lastname');

    console.log('📢 [getActiveAnnouncements] Found:', announcements.length, 'announcements');

    res.status(200).json({
      success: true,
      announcements,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get unread announcements (based on last login)
export const getUnreadAnnouncements = async (req, res) => {
  try {
    const userRole = req.user.role;
    const lastLogin = req.user.lastLogin || req.user.createdAt;
    const now = new Date();
    
    // Use start of tomorrow UTC for timezone buffer
    const comparisonDate = new Date(now);
    comparisonDate.setUTCDate(comparisonDate.getUTCDate() + 1);
    comparisonDate.setUTCHours(0, 0, 0, 0);

    console.log('📢 [getUnreadAnnouncements] User role:', userRole, 'Last login:', lastLogin);

    const announcements = await Announcement.find({
      isActive: true,
      scheduledDate: { $lte: comparisonDate, $gte: lastLogin },
      $and: [
        {
          $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: null },
            { expiryDate: { $gte: now } },
          ],
        },
        {
          $or: [
            { targetAudience: 'all' },
            { targetAudience: userRole },
          ],
        },
      ],
    })
    .sort({ scheduledDate: -1 })
    .populate('createdBy', 'username firstname lastname');

    console.log('📢 [getUnreadAnnouncements] Found:', announcements.length, 'announcements');

    res.status(200).json({
      success: true,
      count: announcements.length,
      announcements,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all announcements (admin/operator)
export const getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username firstname lastname');

    res.status(200).json({
      success: true,
      announcements,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single announcement by ID
export const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    
    console.log('📢 [getAnnouncementById] Fetching announcement:', id);
    
    const announcement = await Announcement.findById(id)
      .populate('createdBy', 'username firstname lastname');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    // Check if user has access to this announcement
    const canAccess = announcement.targetAudience === 'all' || 
                      announcement.targetAudience === userRole ||
                      userRole === 'admin' ||
                      userRole === 'operator';

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this announcement',
      });
    }

    // Check read status for current user
    const isRead = announcement.readBy.some(
      read => read.user.toString() === req.user._id.toString()
    );

    console.log('📢 [getAnnouncementById] Found announcement:', announcement.title);

    res.status(200).json({
      success: true,
      announcement: {
        ...announcement.toObject(),
        isRead,
      },
    });
  } catch (error) {
    console.error('📢 [getAnnouncementById] Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update announcement
export const updateAnnouncement = async (req, res) => {
  try {
    const { image, removeImage, ...updateData } = req.body;
    
    // Get existing announcement
    const existingAnnouncement = await Announcement.findById(req.params.id);
    if (!existingAnnouncement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    // Handle image upload/update
    if (image && image.startsWith('data:')) {
      // New image uploaded (base64)
      try {
        // Delete old image if exists
        if (existingAnnouncement.image?.public_id) {
          await cloudinary.uploader.destroy(existingAnnouncement.image.public_id);
        }
        
        const uploadResult = await cloudinary.uploader.upload(image, {
          folder: 'announcements',
          resource_type: 'image',
          transformation: [
            { width: 1200, height: 630, crop: 'limit' },
            { quality: 'auto:good' },
          ],
        });
        updateData.image = {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url,
        };
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError.message);
      }
    } else if (removeImage) {
      // Remove image
      if (existingAnnouncement.image?.public_id) {
        await cloudinary.uploader.destroy(existingAnnouncement.image.public_id);
      }
      updateData.image = null;
    }

    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // Log admin activity for announcement update
    if (req.user.role === 'admin') {
      const AdminActivityLog = (await import('../models/adminActivityLogModel.js')).default;
      await AdminActivityLog.logActivity({
        adminId: req.user._id,
        adminEmail: req.user.email,
        adminName: `${req.user.firstname || ''} ${req.user.lastname || ''}`.trim() || 'Admin',
        action: 'ANNOUNCEMENT_UPDATE',
        description: `Updated announcement: "${announcement.title}"`,
        previousValue: {
          title: existingAnnouncement.title,
          type: existingAnnouncement.type,
          targetAudience: existingAnnouncement.targetAudience,
          isActive: existingAnnouncement.isActive,
        },
        newValue: {
          title: announcement.title,
          type: announcement.type,
          targetAudience: announcement.targetAudience,
          isActive: announcement.isActive,
        },
        metadata: {
          announcementId: announcement._id,
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
      });
    }

    res.status(200).json({
      success: true,
      announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete announcement
export const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    // Delete image from Cloudinary if exists
    if (announcement.image?.public_id) {
      try {
        await cloudinary.uploader.destroy(announcement.image.public_id);
      } catch (err) {
        console.error('Failed to delete image from Cloudinary:', err);
      }
    }

    // Log admin activity for announcement deletion before deleting
    if (req.user.role === 'admin') {
      const AdminActivityLog = (await import('../models/adminActivityLogModel.js')).default;
      await AdminActivityLog.logActivity({
        adminId: req.user._id,
        adminEmail: req.user.email,
        adminName: `${req.user.firstname || ''} ${req.user.lastname || ''}`.trim() || 'Admin',
        action: 'ANNOUNCEMENT_DELETE',
        description: `Deleted announcement: "${announcement.title}" (${announcement.type})`,
        previousValue: {
          title: announcement.title,
          type: announcement.type,
          targetAudience: announcement.targetAudience,
          scheduledDate: announcement.scheduledDate,
          expiryDate: announcement.expiryDate,
        },
        metadata: {
          announcementId: announcement._id,
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
      });
    }

    await Announcement.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Announcement deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark announcement as read for a user
export const markAnnouncementAsRead = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user.readAnnouncements.includes(announcementId)) {
      user.readAnnouncements.push(announcementId);
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Announcement marked as read',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark all announcements as read
export const markAllAnnouncementsAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const now = new Date();

    console.log('📢 [markAllAsRead] User:', userId, 'Role:', userRole);

    // Get all active announcements for this user
    const announcements = await Announcement.find({
      isActive: true,
      scheduledDate: { $lte: now },
      $and: [
        {
          $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: null },
            { expiryDate: { $gte: now } },
          ],
        },
        {
          $or: [
            { targetAudience: 'all' },
            { targetAudience: userRole },
          ],
        },
      ],
    });

    const announcementIds = announcements.map(a => a._id);
    console.log('📢 [markAllAsRead] Marking', announcementIds.length, 'announcements as read');
    
    await User.findByIdAndUpdate(userId, {
      readAnnouncements: announcementIds,
    });

    res.status(200).json({
      success: true,
      message: 'All announcements marked as read',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get inbox with read/unread status
export const getInbox = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user._id;
    const now = new Date();
    const { filter } = req.query; // 'all', 'unread', 'read'

    // For date comparison, use start of tomorrow UTC to account for timezone differences
    // This ensures users in timezones ahead of UTC see announcements for their "today"
    const comparisonDate = new Date(now);
    comparisonDate.setUTCDate(comparisonDate.getUTCDate() + 1);
    comparisonDate.setUTCHours(0, 0, 0, 0);

    console.log('📢 [getInbox] User:', userId, 'Role:', userRole, 'Filter:', filter);
    console.log('📢 [getInbox] Server time (UTC):', now.toISOString());
    console.log('📢 [getInbox] Comparison date (start of tomorrow UTC):', comparisonDate.toISOString());

    const user = await User.findById(userId);
    const readIds = user.readAnnouncements || [];
    console.log('📢 [getInbox] User has', readIds.length, 'read announcements');

    // Build the base query with proper $and for multiple $or conditions
    let andConditions = [
      {
        $or: [
          { expiryDate: { $exists: false } },
          { expiryDate: null },
          { expiryDate: { $gte: now } },
        ],
      },
      {
        $or: [
          { targetAudience: 'all' },
          { targetAudience: userRole },
        ],
      },
    ];

    // Apply filter
    if (filter === 'unread') {
      andConditions.push({ _id: { $nin: readIds } });
    } else if (filter === 'read') {
      andConditions.push({ _id: { $in: readIds } });
    }

    const query = {
      isActive: true,
      scheduledDate: { $lte: comparisonDate },
      $and: andConditions,
    };

    console.log('📢 [getInbox] Query:', JSON.stringify(query, null, 2));

    // First, let's check what announcements exist in the database
    const allAnnouncements = await Announcement.find({}).select('title scheduledDate isActive targetAudience');
    console.log('📢 [getInbox] All announcements in DB:', allAnnouncements.map(a => ({
      id: a._id,
      title: a.title,
      scheduledDate: a.scheduledDate,
      isActive: a.isActive,
      targetAudience: a.targetAudience,
      wouldMatch: a.isActive && new Date(a.scheduledDate) <= comparisonDate && ['all', userRole].includes(a.targetAudience),
    })));

    const announcements = await Announcement.find(query)
      .sort({ scheduledDate: -1 })
      .populate('createdBy', 'username firstname lastname');

    // Add isRead flag to each announcement
    const announcementsWithStatus = announcements.map(announcement => ({
      ...announcement.toObject(),
      isRead: readIds.some(id => id.toString() === announcement._id.toString()),
    }));

    const unreadCount = await Announcement.countDocuments({
      isActive: true,
      scheduledDate: { $lte: comparisonDate },
      $and: [
        {
          $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: null },
            { expiryDate: { $gte: now } },
          ],
        },
        {
          $or: [
            { targetAudience: 'all' },
            { targetAudience: userRole },
          ],
        },
        { _id: { $nin: readIds } },
      ],
    });

    console.log('📢 [getInbox] Found:', announcements.length, 'announcements, Unread:', unreadCount);

    res.status(200).json({
      success: true,
      announcements: announcementsWithStatus,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get unread count only
export const getUnreadCount = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user._id;
    const now = new Date();
    
    // Use start of tomorrow UTC for timezone buffer
    const comparisonDate = new Date(now);
    comparisonDate.setUTCDate(comparisonDate.getUTCDate() + 1);
    comparisonDate.setUTCHours(0, 0, 0, 0);

    console.log('📢 [getUnreadCount] User:', userId, 'Role:', userRole);

    const user = await User.findById(userId);
    const readIds = user.readAnnouncements || [];

    const unreadCount = await Announcement.countDocuments({
      isActive: true,
      scheduledDate: { $lte: comparisonDate },
      $and: [
        {
          $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: null },
            { expiryDate: { $gte: now } },
          ],
        },
        {
          $or: [
            { targetAudience: 'all' },
            { targetAudience: userRole },
          ],
        },
        { _id: { $nin: readIds } },
      ],
    });

    console.log('📢 [getUnreadCount] Unread count:', unreadCount);

    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
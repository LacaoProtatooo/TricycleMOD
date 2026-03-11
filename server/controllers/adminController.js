import User from '../models/userModel.js';
import AdminActivityLog from '../models/adminActivityLogModel.js';
import { sendNotification } from '../utils/firebase.js';

/**
 * Suspend a driver (admin only)
 * POST /api/admin/drivers/:userId/suspend
 */
export const suspendDriver = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days, reason, ruleViolated, offenseNumber } = req.body;
    const adminUser = req.user;

    // Validate inputs
    if (!days || days < 1) {
      return res.status(400).json({
        success: false,
        message: 'Please specify the number of days for suspension',
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reason for suspension',
      });
    }

    // Find target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Only drivers can be suspended
    if (targetUser.role !== 'driver' && targetUser.role !== 'driOps') {
      return res.status(400).json({
        success: false,
        message: 'Only drivers can be suspended',
      });
    }

    // Calculate suspension end date
    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + parseInt(days));

    // Update user suspension status
    targetUser.isSuspended = true;
    targetUser.suspendedUntil = suspendedUntil;
    targetUser.suspensionReason = reason;
    
    // Add to suspension history
    targetUser.suspensionHistory.push({
      suspendedAt: new Date(),
      suspendedUntil: suspendedUntil,
      reason: reason,
      suspendedBy: adminUser._id,
      ruleViolated: ruleViolated || null,
      offenseNumber: offenseNumber || null,
    });

    await targetUser.save();

    // Log the admin activity
    await AdminActivityLog.logActivity({
      adminId: adminUser._id,
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstname} ${adminUser.lastname}`,
      action: 'DRIVER_SUSPENDED',
      description: `Suspended driver ${targetUser.email} for ${days} days. Reason: ${reason}`,
      targetUserId: targetUser._id,
      targetUserEmail: targetUser.email,
      targetUserName: `${targetUser.firstname} ${targetUser.lastname}`,
      previousValue: { isSuspended: false },
      newValue: { isSuspended: true, suspendedUntil, reason, ruleViolated, offenseNumber },
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
    });

    // Send notification to the driver (with force logout)
    if (targetUser.FCMToken) {
      await sendNotification(
        targetUser.FCMToken,
        '⚠️ Account Suspended',
        `Your account has been suspended for ${days} days. Reason: ${reason}`,
        {
          type: 'suspension',
          action: 'force_logout',
          suspendedUntil: suspendedUntil.toISOString(),
          reason: reason,
        }
      );
    }

    res.status(200).json({
      success: true,
      message: `Driver suspended for ${days} days`,
      user: {
        _id: targetUser._id,
        email: targetUser.email,
        firstname: targetUser.firstname,
        lastname: targetUser.lastname,
        isSuspended: targetUser.isSuspended,
        suspendedUntil: targetUser.suspendedUntil,
        suspensionReason: targetUser.suspensionReason,
      },
    });
  } catch (error) {
    console.error('Error suspending driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suspend driver',
      error: error.message,
    });
  }
};

/**
 * Reinstate a driver (admin only)
 * POST /api/admin/drivers/:userId/reinstate
 */
export const reinstateDriver = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUser = req.user;

    // Find target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!targetUser.isSuspended) {
      return res.status(400).json({
        success: false,
        message: 'Driver is not currently suspended',
      });
    }

    const previousSuspension = {
      isSuspended: targetUser.isSuspended,
      suspendedUntil: targetUser.suspendedUntil,
      suspensionReason: targetUser.suspensionReason,
    };

    // Remove suspension
    targetUser.isSuspended = false;
    targetUser.suspendedUntil = null;
    targetUser.suspensionReason = null;

    await targetUser.save();

    // Log the admin activity
    await AdminActivityLog.logActivity({
      adminId: adminUser._id,
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstname} ${adminUser.lastname}`,
      action: 'DRIVER_REINSTATED',
      description: `Reinstated driver ${targetUser.email}`,
      targetUserId: targetUser._id,
      targetUserEmail: targetUser.email,
      targetUserName: `${targetUser.firstname} ${targetUser.lastname}`,
      previousValue: previousSuspension,
      newValue: { isSuspended: false, suspendedUntil: null, suspensionReason: null },
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
    });

    // Send notification to the driver (with force logout to refresh status)
    if (targetUser.FCMToken) {
      await sendNotification(
        targetUser.FCMToken,
        '✅ Driver Reinstated',
        'Your account has been reinstated. You can now continue operating.',
        {
          type: 'reinstatement',
          action: 'force_logout',
        }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Driver reinstated successfully',
      user: {
        _id: targetUser._id,
        email: targetUser.email,
        firstname: targetUser.firstname,
        lastname: targetUser.lastname,
        isSuspended: targetUser.isSuspended,
      },
    });
  } catch (error) {
    console.error('Error reinstating driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reinstate driver',
      error: error.message,
    });
  }
};

/**
 * Change user role (admin only)
 * PUT /api/admin/users/:userId/role
 */
export const changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole, confirmationCode } = req.body;
    const adminUser = req.user;

    // Validate new role
    const allowedRoles = ['guest', 'driver', 'operator', 'driOps'];
    if (!allowedRoles.includes(newRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}`,
      });
    }

    // Find target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent changing admin roles
    if (targetUser.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot change role of admin users',
      });
    }

    // Validate confirmation code format: webttrac_(user email)
    const expectedConfirmationCode = `webttrac_${targetUser.email}`;
    if (confirmationCode !== expectedConfirmationCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmation code. Please enter the correct confirmation code.',
        expectedFormat: 'webttrac_(user email)',
      });
    }

    const previousRole = targetUser.role;

    // If role is the same, no change needed
    if (previousRole === newRole) {
      return res.status(400).json({
        success: false,
        message: `User already has the role: ${newRole}`,
      });
    }

    // Update the user's role
    targetUser.role = newRole;
    await targetUser.save();

    // Log the admin activity
    await AdminActivityLog.logActivity({
      adminId: adminUser._id,
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstname} ${adminUser.lastname}`,
      action: 'ROLE_CHANGE',
      description: `Changed role of user ${targetUser.email} from "${previousRole}" to "${newRole}"`,
      targetUserId: targetUser._id,
      targetUserEmail: targetUser.email,
      targetUserName: `${targetUser.firstname} ${targetUser.lastname}`,
      previousValue: { role: previousRole },
      newValue: { role: newRole },
      confirmationCode: confirmationCode,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
    });

    res.status(200).json({
      success: true,
      message: `User role successfully changed from "${previousRole}" to "${newRole}"`,
      user: {
        _id: targetUser._id,
        email: targetUser.email,
        firstname: targetUser.firstname,
        lastname: targetUser.lastname,
        role: targetUser.role,
      },
    });
  } catch (error) {
    console.error('Error changing user role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change user role',
      error: error.message,
    });
  }
};

/**
 * Get all admin activity logs (admin only)
 * GET /api/admin/logs
 */
export const getAdminActivityLogs = async (req, res) => {
  try {
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
    } = req.query;

    const result = await AdminActivityLog.getActivityLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      adminId,
      action,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    });

    // Get unique action types for filter options
    const actionTypes = await AdminActivityLog.distinct('action');

    // Get admin list for filter options
    const adminIds = await AdminActivityLog.distinct('adminId');
    const admins = await User.find({ _id: { $in: adminIds } })
      .select('firstname lastname email')
      .lean();

    res.status(200).json({
      success: true,
      ...result,
      filters: {
        actionTypes,
        admins: admins.map(a => ({
          _id: a._id,
          name: `${a.firstname} ${a.lastname}`,
          email: a.email,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching admin activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin activity logs',
      error: error.message,
    });
  }
};

/**
 * Get single admin activity log details
 * GET /api/admin/logs/:logId
 */
export const getAdminActivityLogDetails = async (req, res) => {
  try {
    const { logId } = req.params;

    const log = await AdminActivityLog.findById(logId)
      .populate('adminId', 'firstname lastname email image')
      .populate('targetUserId', 'firstname lastname email image role')
      .lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Activity log not found',
      });
    }

    res.status(200).json({
      success: true,
      log,
    });
  } catch (error) {
    console.error('Error fetching admin activity log details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity log details',
      error: error.message,
    });
  }
};

/**
 * Get activity log stats/summary (admin only)
 * GET /api/admin/logs/stats
 */
export const getAdminActivityStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    // Total actions count
    const totalActions = await AdminActivityLog.countDocuments(dateQuery);

    // Actions by type
    const actionsByType = await AdminActivityLog.aggregate([
      { $match: dateQuery },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Actions by admin
    const actionsByAdmin = await AdminActivityLog.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$adminId',
          adminEmail: { $first: '$adminEmail' },
          adminName: { $first: '$adminName' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Recent activity timeline (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activityTimeline = await AdminActivityLog.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalActions,
        actionsByType: actionsByType.map(item => ({
          action: item._id,
          count: item.count,
        })),
        actionsByAdmin,
        activityTimeline: activityTimeline.map(item => ({
          date: item._id,
          count: item.count,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching admin activity stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity stats',
      error: error.message,
    });
  }
};

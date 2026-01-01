import User from '../models/userModel.js';
import AdminActivityLog from '../models/adminActivityLogModel.js';

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
    const allowedRoles = ['guest', 'driver', 'operator'];
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

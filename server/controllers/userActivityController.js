import User from '../models/userModel.js';
import UserActivity from '../models/userActivityModel.js';

/**
 * Update user activity (heartbeat endpoint)
 * POST /api/activity/heartbeat
 */
export const updateHeartbeat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { platform, deviceType, appVersion, location } = req.body;

    await UserActivity.updateActivity(
      userId,
      {
        platform: platform || 'unknown',
        deviceType: deviceType || '',
        appVersion: appVersion || '',
      },
      location // Pass location data (can be null)
    );

    res.status(200).json({
      success: true,
      message: 'Activity updated',
    });
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update activity',
      error: error.message,
    });
  }
};

/**
 * Mark user as offline (logout)
 * POST /api/activity/offline
 */
export const markOffline = async (req, res) => {
  try {
    const userId = req.user._id;
    await UserActivity.setOffline(userId);

    res.status(200).json({
      success: true,
      message: 'Marked as offline',
    });
  } catch (error) {
    console.error('Error marking offline:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark offline',
      error: error.message,
    });
  }
};

/**
 * Get all users with activity status (admin only)
 * GET /api/activity/users
 */
export const getAllUsersWithActivity = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      status, // 'online', 'offline', 'all'
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // First, mark inactive users as offline
    await UserActivity.markInactiveUsersOffline();

    // Build user query
    const userQuery = {};
    
    // Exclude admin users from the list
    userQuery.role = { $ne: 'admin' };
    
    if (role && role !== 'all') {
      userQuery.role = role;
    }

    if (search) {
      userQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Get all users matching the query
    const users = await User.find(userQuery)
      .select('firstName lastName email phoneNumber image role createdAt')
      .lean();

    // Get activity data for all users
    const userIds = users.map(u => u._id);
    const activities = await UserActivity.find({ userId: { $in: userIds } }).lean();

    // Create activity lookup map
    const activityMap = {};
    activities.forEach(a => {
      activityMap[a.userId.toString()] = a;
    });

    // Merge users with activity data
    let usersWithActivity = users.map(user => {
      const activity = activityMap[user._id.toString()];
      return {
        ...user,
        profileImage: user.image?.url || null,
        isOnline: activity?.isOnline || false,
        lastSeen: activity?.lastSeen || null,
        lastActiveAt: activity?.lastActiveAt || null,
        deviceInfo: activity?.deviceInfo || { platform: 'unknown' },
      };
    });

    // Filter by online status if specified
    if (status === 'online') {
      usersWithActivity = usersWithActivity.filter(u => u.isOnline);
    } else if (status === 'offline') {
      usersWithActivity = usersWithActivity.filter(u => !u.isOnline);
    }

    // Sort users
    usersWithActivity.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
          bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case 'role':
          aVal = a.role;
          bVal = b.role;
          break;
        case 'lastSeen':
          aVal = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
          bVal = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
          break;
        case 'isOnline':
          aVal = a.isOnline ? 1 : 0;
          bVal = b.isOnline ? 1 : 0;
          break;
        default: // createdAt
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Pagination
    const totalUsers = usersWithActivity.length;
    const totalPages = Math.ceil(totalUsers / parseInt(limit));
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedUsers = usersWithActivity.slice(startIndex, startIndex + parseInt(limit));

    // Get counts by status
    const onlineCount = usersWithActivity.filter(u => u.isOnline).length;
    const offlineCount = usersWithActivity.filter(u => !u.isOnline).length;

    res.status(200).json({
      success: true,
      users: paginatedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers,
        limit: parseInt(limit),
      },
      counts: {
        online: onlineCount,
        offline: offlineCount,
        total: totalUsers,
      },
    });
  } catch (error) {
    console.error('Error fetching users with activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message,
    });
  }
};

/**
 * Get single user details with activity (admin only)
 * GET /api/activity/users/:userId
 */
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const activity = await UserActivity.findOne({ userId }).lean();

    const userWithActivity = {
      ...user,
      profileImage: user.image?.url || null,
      isOnline: activity?.isOnline || false,
      lastSeen: activity?.lastSeen || null,
      lastActiveAt: activity?.lastActiveAt || null,
      deviceInfo: activity?.deviceInfo || { platform: 'unknown' },
    };

    res.status(200).json({
      success: true,
      user: userWithActivity,
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
      error: error.message,
    });
  }
};

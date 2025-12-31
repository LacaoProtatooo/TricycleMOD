import User from '../models/userModel.js';
import Booking from '../models/bookingModel.js';
import Tricycle from '../models/tricycleModel.js';

/**
 * Get admin dashboard statistics
 * GET /api/dashboard/stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Get user counts by role
    const [userCounts, totalTricycles, revenueData, monthlyRevenue] = await Promise.all([
      // Count users by role
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      
      // Total tricycles
      Tricycle.countDocuments(),
      
      // Total revenue from completed bookings
      Booking.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$agreedFare' },
            totalTrips: { $sum: 1 },
            avgFare: { $avg: '$agreedFare' },
          },
        },
      ]),
      
      // Monthly revenue for the current year
      Booking.aggregate([
        {
          $match: {
            status: 'completed',
            completedAt: {
              $gte: new Date(new Date().getFullYear(), 0, 1), // Start of current year
            },
          },
        },
        {
          $group: {
            _id: { $month: '$completedAt' },
            revenue: { $sum: '$agreedFare' },
            trips: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Format user counts
    const userCountMap = {};
    userCounts.forEach(u => {
      userCountMap[u._id] = u.count;
    });

    // Calculate total users (excluding admins from count)
    const totalUsers = (userCountMap.guest || 0) + (userCountMap.driver || 0) + (userCountMap.operator || 0);
    const totalDrivers = userCountMap.driver || 0;
    const totalOperators = userCountMap.operator || 0;
    const totalGuests = userCountMap.guest || 0;

    // Format monthly revenue (fill all 12 months)
    const currentMonth = new Date().getMonth(); // 0-11 (0-indexed)
    const monthlyRevenueData = Array(12).fill(0);
    const monthlyTripsData = Array(12).fill(0);
    
    monthlyRevenue.forEach(m => {
      monthlyRevenueData[m._id - 1] = m.revenue;
      monthlyTripsData[m._id - 1] = m.trips;
    });

    res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          guests: totalGuests,
          drivers: totalDrivers,
          operators: totalOperators,
        },
        tricycles: {
          total: totalTricycles,
        },
        revenue: {
          total: revenueData[0]?.totalRevenue || 0,
          totalTrips: revenueData[0]?.totalTrips || 0,
          avgFare: revenueData[0]?.avgFare || 0,
        },
        monthlyRevenue: {
          data: monthlyRevenueData,
          trips: monthlyTripsData,
          currentMonth, // 0-indexed month
        },
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message,
    });
  }
};

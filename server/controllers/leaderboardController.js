import User from '../models/userModel.js';
import QueueEntry from '../models/queueEntryModel.js';
import Booking from '../models/bookingModel.js';

/**
 * Get leaderboard - top drivers by trip count
 * Supports filtering by month/year
 */
export const getLeaderboard = async (req, res) => {
  try {
    const { month, year, limit = 20 } = req.query;
    const currentDate = new Date();
    const targetYear = parseInt(year) || currentDate.getFullYear();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth(); // 0-indexed

    // Calculate date range for the month
    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    // Aggregate completed queue entries (trips) for the month
    const queueTripCounts = await QueueEntry.aggregate([
      {
        $match: {
          status: 'done',
          updatedAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$driver',
          monthlyTrips: { $sum: 1 }
        }
      }
    ]);

    // Aggregate completed booking trips for the month
    const bookingTripCounts = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          driver: { $ne: null },
          completedAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$driver',
          monthlyTrips: { $sum: 1 }
        }
      }
    ]);

    // Merge queue + booking counts per driver
    const mergedMap = {};
    for (const entry of queueTripCounts) {
      const key = entry._id?.toString();
      if (key) mergedMap[key] = (mergedMap[key] || 0) + entry.monthlyTrips;
    }
    for (const entry of bookingTripCounts) {
      const key = entry._id?.toString();
      if (key) mergedMap[key] = (mergedMap[key] || 0) + entry.monthlyTrips;
    }

    // Convert to sorted array
    const tripCounts = Object.entries(mergedMap)
      .map(([id, count]) => ({ _id: id, monthlyTrips: count }))
      .sort((a, b) => b.monthlyTrips - a.monthlyTrips)
      .slice(0, parseInt(limit));

    // Get driver details
    const driverIds = tripCounts.map(t => t._id);
    const drivers = await User.find(
      { _id: { $in: driverIds } },
      'firstname lastname username image tripCount rating'
    ).lean();

    // Create a map for quick lookup
    const driverMap = {};
    drivers.forEach(d => {
      driverMap[d._id.toString()] = d;
    });

    // Build leaderboard with rank
    const leaderboard = tripCounts.map((entry, index) => {
      const driver = driverMap[entry._id?.toString()] || {};
      return {
        rank: index + 1,
        driverId: entry._id,
        firstname: driver.firstname || 'Unknown',
        lastname: driver.lastname || 'Driver',
        username: driver.username || '',
        image: driver.image || null,
        monthlyTrips: entry.monthlyTrips,
        totalTrips: driver.tripCount || 0,
        rating: driver.rating || 0,
      };
    });

    // Get current user's rank if authenticated
    let userRank = null;
    if (req.user?.id) {
      // Count user's queue trips for the month
      const userQueueTrips = await QueueEntry.countDocuments({
        driver: req.user.id,
        status: 'done',
        updatedAt: { $gte: startOfMonth, $lte: endOfMonth }
      });

      // Count user's booking trips for the month
      const userBookingTrips = await Booking.countDocuments({
        driver: req.user.id,
        status: 'completed',
        completedAt: { $gte: startOfMonth, $lte: endOfMonth }
      });

      const userTrips = userQueueTrips + userBookingTrips;

      // Find user's position (count how many drivers have more trips)
      const driversAbove = Object.values(mergedMap).filter(count => count > userTrips).length;

      userRank = {
        rank: driversAbove + 1,
        monthlyTrips: userTrips,
      };
    }

    res.status(200).json({
      success: true,
      data: {
        leaderboard,
        period: {
          month: targetMonth + 1,
          year: targetYear,
          monthName: startOfMonth.toLocaleString('en-US', { month: 'long' }),
        },
        userRank,
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Get all-time leaderboard based on total trip count
 */
export const getAllTimeLeaderboard = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const drivers = await User.find(
      { role: 'driver', tripCount: { $gt: 0 } },
      'firstname lastname username image tripCount rating numReviews'
    )
      .sort({ tripCount: -1 })
      .limit(parseInt(limit))
      .lean();

    const leaderboard = drivers.map((driver, index) => ({
      rank: index + 1,
      driverId: driver._id,
      firstname: driver.firstname,
      lastname: driver.lastname,
      username: driver.username,
      image: driver.image,
      totalTrips: driver.tripCount,
      rating: driver.rating || 0,
      numReviews: driver.numReviews || 0,
    }));

    // Get current user's rank if authenticated
    let userRank = null;
    if (req.user?.id) {
      const user = await User.findById(req.user.id, 'tripCount').lean();
      if (user) {
        const higherCount = await User.countDocuments({
          role: 'driver',
          tripCount: { $gt: user.tripCount || 0 }
        });
        userRank = {
          rank: higherCount + 1,
          totalTrips: user.tripCount || 0,
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        leaderboard,
        userRank,
      }
    });
  } catch (error) {
    console.error('Error fetching all-time leaderboard:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Get available months with data for dropdown
 */
export const getAvailableMonths = async (req, res) => {
  try {
    // Get months from queue entries
    const queueMonths = await QueueEntry.aggregate([
      { $match: { status: 'done' } },
      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get months from completed bookings
    const bookingMonths = await Booking.aggregate([
      { $match: { status: 'completed', completedAt: { $ne: null } } },
      {
        $group: {
          _id: {
            year: { $year: '$completedAt' },
            month: { $month: '$completedAt' }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Merge months from both sources
    const monthMap = {};
    for (const m of queueMonths) {
      const key = `${m._id.year}-${m._id.month}`;
      monthMap[key] = { year: m._id.year, month: m._id.month, count: m.count };
    }
    for (const m of bookingMonths) {
      const key = `${m._id.year}-${m._id.month}`;
      if (monthMap[key]) {
        monthMap[key].count += m.count;
      } else {
        monthMap[key] = { year: m._id.year, month: m._id.month, count: m.count };
      }
    }

    const available = Object.values(monthMap)
      .sort((a, b) => b.year - a.year || b.month - a.month)
      .slice(0, 12)
      .map(m => ({
        year: m.year,
        month: m.month,
        monthName: new Date(m.year, m.month - 1).toLocaleString('en-US', { month: 'long' }),
        tripCount: m.count,
      }));

    res.status(200).json({ success: true, data: available });
  } catch (error) {
    console.error('Error fetching available months:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

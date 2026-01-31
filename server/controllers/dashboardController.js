import User from '../models/userModel.js';
import Booking from '../models/bookingModel.js';
import Tricycle from '../models/tricycleModel.js';
import Complaint from '../models/complaintModel.js';
import Review from '../models/reviewModel.js';

/**
 * Get sentiment quadrant data for scatter plot visualization
 * GET /api/dashboard/sentiment-quadrant
 * 
 * Returns complaint data formatted for quadrant visualization:
 * - X-axis: Sentiment score (-1 to 1, negative to positive)
 * - Y-axis: Confidence level (0 to 1)
 */
export const getSentimentQuadrantData = async (req, res) => {
  try {
    const { category, status, limit = 200 } = req.query;
    
    // Build query filter
    const filter = {
      'sentimentAnalysis.sentiment': { $exists: true },
      'sentimentAnalysis.confidence': { $exists: true },
    };
    
    if (category) {
      filter.category = category;
    }
    
    if (status) {
      filter.status = status;
    }
    
    // Fetch complaints with sentiment analysis
    const complaints = await Complaint.find(filter)
      .select('category status sentimentAnalysis description createdAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
    // Transform data for scatter plot
    const quadrantData = complaints.map(complaint => {
      const sentiment = complaint.sentimentAnalysis;
      
      // Calculate sentiment score (-1 to 1)
      // Negative sentiment = negative score, Positive = positive score
      let sentimentScore = 0;
      if (sentiment.scores) {
        const positive = sentiment.scores.POSITIVE || 0;
        const negative = sentiment.scores.NEGATIVE || 0;
        sentimentScore = positive - negative; // Range: -1 to 1
      } else {
        // Fallback based on sentiment label
        switch (sentiment.sentiment) {
          case 'negative':
            sentimentScore = -0.7 * (sentiment.confidence || 0.5);
            break;
          case 'positive':
            sentimentScore = 0.7 * (sentiment.confidence || 0.5);
            break;
          default:
            sentimentScore = 0;
        }
      }
      
      return {
        _id: complaint._id,
        category: complaint.category,
        status: complaint.status,
        sentiment: sentiment.sentiment,
        sentimentScore: Math.max(-1, Math.min(1, sentimentScore)), // Clamp to -1 to 1
        confidence: sentiment.confidence || 0,
        severityScore: sentiment.severityScore || 0,
        urgency: sentiment.urgency || 'normal',
        flags: sentiment.flags || {},
        // Include detected indicator words for tooltip display
        taglishIndicators: sentiment.taglishIndicators || { negativeWords: [], positiveWords: [], isTaglish: false },
        descriptionPreview: complaint.description ? complaint.description.substring(0, 100) + (complaint.description.length > 100 ? '...' : '') : '',
        createdAt: complaint.createdAt,
      };
    });
    
    // Calculate summary statistics
    const summary = {
      total: quadrantData.length,
      critical: quadrantData.filter(d => d.urgency === 'critical').length,
      high: quadrantData.filter(d => d.urgency === 'high').length,
      medium: quadrantData.filter(d => d.urgency === 'medium').length,
      low: quadrantData.filter(d => d.urgency === 'low').length,
      normal: quadrantData.filter(d => d.urgency === 'normal').length,
      avgConfidence: quadrantData.length > 0 
        ? (quadrantData.reduce((sum, d) => sum + d.confidence, 0) / quadrantData.length).toFixed(2)
        : 0,
      avgSeverity: quadrantData.length > 0
        ? (quadrantData.reduce((sum, d) => sum + d.severityScore, 0) / quadrantData.length).toFixed(2)
        : 0,
      byQuadrant: {
        topLeft: quadrantData.filter(d => d.sentimentScore < 0 && d.confidence >= 0.5).length,    // High confidence negative
        topRight: quadrantData.filter(d => d.sentimentScore >= 0 && d.confidence >= 0.5).length,  // High confidence positive
        bottomLeft: quadrantData.filter(d => d.sentimentScore < 0 && d.confidence < 0.5).length,  // Low confidence negative
        bottomRight: quadrantData.filter(d => d.sentimentScore >= 0 && d.confidence < 0.5).length, // Low confidence positive
      },
    };
    
    res.status(200).json({
      success: true,
      data: {
        complaints: quadrantData,
        summary,
      },
    });
  } catch (error) {
    console.error('Error fetching sentiment quadrant data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sentiment quadrant data',
      error: error.message,
    });
  }
};

/**
 * Get admin dashboard statistics
 * GET /api/dashboard/stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Get year from query params, default to current year
    const selectedYear = parseInt(req.query.year) || new Date().getFullYear();
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    
    // Get user counts by role
    const [userCounts, totalTricycles, revenueData, monthlyRevenue, sentimentStats, reviewStats, complaintStats] = await Promise.all([
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
      
      // Monthly revenue for the selected year
      Booking.aggregate([
        {
          $match: {
            status: 'completed',
            completedAt: {
              $gte: yearStart,
              $lte: yearEnd,
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
      
      // Sentiment analysis statistics from complaints
      Complaint.aggregate([
        {
          $match: {
            'sentimentAnalysis.sentiment': { $exists: true },
          },
        },
        {
          $group: {
            _id: '$sentimentAnalysis.sentiment',
            count: { $sum: 1 },
            avgConfidence: { $avg: '$sentimentAnalysis.confidence' },
            avgSeverity: { $avg: '$sentimentAnalysis.severityScore' },
          },
        },
      ]),
      
      // Review/Rating statistics (satisfaction)
      Review.aggregate([
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            avgRating: { $avg: '$rating' },
            rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          },
        },
      ]),
      
      // Complaint statistics
      Complaint.aggregate([
        {
          $facet: {
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
            byCategory: [
              { $group: { _id: '$category', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 5 },
            ],
            byUrgency: [
              { $match: { 'sentimentAnalysis.urgency': { $exists: true } } },
              { $group: { _id: '$sentimentAnalysis.urgency', count: { $sum: 1 } } },
            ],
            total: [
              { $count: 'count' },
            ],
            monthly: [
              {
                $match: {
                  createdAt: {
                    $gte: yearStart,
                    $lte: yearEnd,
                  },
                },
              },
              {
                $group: {
                  _id: { $month: '$createdAt' },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
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
    const currentYear = new Date().getFullYear();
    const currentMonth = selectedYear === currentYear ? new Date().getMonth() : 11; // 0-11 (0-indexed), show all months for past years
    const monthlyRevenueData = Array(12).fill(0);
    const monthlyTripsData = Array(12).fill(0);
    
    monthlyRevenue.forEach(m => {
      monthlyRevenueData[m._id - 1] = m.revenue;
      monthlyTripsData[m._id - 1] = m.trips;
    });

    // Format sentiment statistics
    const sentimentMap = { positive: 0, negative: 0, neutral: 0 };
    const sentimentConfidence = { positive: 0, negative: 0, neutral: 0 };
    const sentimentSeverity = { positive: 0, negative: 0, neutral: 0 };
    
    sentimentStats.forEach(s => {
      if (s._id) {
        sentimentMap[s._id] = s.count;
        sentimentConfidence[s._id] = s.avgConfidence || 0;
        sentimentSeverity[s._id] = s.avgSeverity || 0;
      }
    });
    
    const totalSentimentAnalyzed = sentimentMap.positive + sentimentMap.negative + sentimentMap.neutral;

    // Format review statistics
    const reviews = reviewStats[0] || {
      totalReviews: 0,
      avgRating: 0,
      rating5: 0,
      rating4: 0,
      rating3: 0,
      rating2: 0,
      rating1: 0,
    };

    // Calculate satisfaction percentage (4-5 stars = satisfied)
    const satisfiedReviews = reviews.rating5 + reviews.rating4;
    const satisfactionRate = reviews.totalReviews > 0 
      ? ((satisfiedReviews / reviews.totalReviews) * 100).toFixed(1) 
      : 0;

    // Format complaint statistics
    const complaints = complaintStats[0] || { byStatus: [], byCategory: [], byUrgency: [], total: [], monthly: [] };
    
    const complaintStatusMap = {};
    complaints.byStatus.forEach(s => {
      complaintStatusMap[s._id] = s.count;
    });
    
    const complaintUrgencyMap = {};
    complaints.byUrgency.forEach(u => {
      complaintUrgencyMap[u._id] = u.count;
    });
    
    const monthlyComplaints = Array(12).fill(0);
    complaints.monthly.forEach(m => {
      monthlyComplaints[m._id - 1] = m.count;
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
          selectedYear, // The year being displayed
        },
        // New: Sentiment Analysis Overview
        sentiment: {
          total: totalSentimentAnalyzed,
          breakdown: sentimentMap,
          confidence: sentimentConfidence,
          severity: sentimentSeverity,
        },
        // New: Satisfaction/Reviews Overview
        satisfaction: {
          totalReviews: reviews.totalReviews,
          avgRating: parseFloat((reviews.avgRating || 0).toFixed(2)),
          satisfactionRate: parseFloat(satisfactionRate),
          distribution: {
            5: reviews.rating5,
            4: reviews.rating4,
            3: reviews.rating3,
            2: reviews.rating2,
            1: reviews.rating1,
          },
        },
        // New: Complaints Overview
        complaints: {
          total: complaints.total[0]?.count || 0,
          byStatus: complaintStatusMap,
          topCategories: complaints.byCategory,
          byUrgency: complaintUrgencyMap,
          monthly: monthlyComplaints,
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

import BoundarySettlement from '../models/boundarySettlementModel.js';
import Tricycle from '../models/tricycleModel.js';
import User from '../models/userModel.js';

/**
 * Get driver's boundary info and pending settlements
 * GET /api/boundary/driver-info
 */
export const getDriverBoundaryInfo = async (req, res) => {
  try {
    const driverId = req.user.id;

    // Find tricycle assigned to this driver
    const tricycle = await Tricycle.findOne({ driver: driverId })
      .populate('operator', 'firstname lastname phone')
      .select('plateNumber bodyNumber boundary operator createdAt');

    if (!tricycle) {
      return res.status(200).json({
        success: true,
        hasTricycle: false,
        message: 'No tricycle assigned to you'
      });
    }

    // Get pending settlements (recorded payments awaiting operator actions)
    const pendingSettlements = await BoundarySettlement.find({
      driver: driverId,
      status: { $in: ['pending', 'paid'] }
    }).sort({ createdAt: -1 });

    // Get recent confirmed settlements (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSettlements = await BoundarySettlement.find({
      driver: driverId,
      status: 'confirmed',
      confirmedAt: { $gte: thirtyDaysAgo }
    }).sort({ confirmedAt: -1 }).limit(10);

    // Calculate total pending amount (payments awaiting confirmation)
    const totalPending = pendingSettlements
      .filter(s => s.status === 'pending')
      .reduce((sum, s) => sum + s.amount, 0);

    // Calculate total paid but awaiting confirmation
    const totalAwaitingConfirmation = pendingSettlements
      .filter(s => s.status === 'paid')
      .reduce((sum, s) => sum + s.amount, 0);

    // Calculate outstanding balance based on boundary type and time elapsed
    const boundaryAmount = tricycle.boundary?.amount || 0;
    const settlementType = tricycle.boundary?.settlementType || 'daily';
    let outstandingBalance = 0;
    let daysSinceLastSettlement = 0;
    let lastSettledDate = null;

    if (boundaryAmount > 0) {
      // Find the last confirmed or paid settlement
      const lastSettlement = await BoundarySettlement.findOne({
        driver: driverId,
        tricycle: tricycle._id,
        status: { $in: ['confirmed', 'paid'] }
      }).sort({ periodEnd: -1, createdAt: -1 });

      // Determine the reference date (last settlement or tricycle assignment)
      const referenceDate = lastSettlement?.periodEnd || tricycle.boundary?.lastSettledAt || tricycle.createdAt;
      lastSettledDate = referenceDate;

      const now = new Date();
      const diffTime = now - new Date(referenceDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      daysSinceLastSettlement = Math.max(0, diffDays);

      // Calculate outstanding based on settlement type
      if (settlementType === 'daily') {
        outstandingBalance = daysSinceLastSettlement * boundaryAmount;
      } else if (settlementType === 'weekly') {
        const weeksSinceLastSettlement = Math.floor(daysSinceLastSettlement / 7);
        outstandingBalance = weeksSinceLastSettlement * boundaryAmount;
      } else if (settlementType === 'monthly') {
        // Approximate months
        const monthsSinceLastSettlement = Math.floor(daysSinceLastSettlement / 30);
        outstandingBalance = monthsSinceLastSettlement * boundaryAmount;
      }

      // Subtract any pending payments (not yet confirmed but already paid)
      outstandingBalance = Math.max(0, outstandingBalance - totalAwaitingConfirmation);
    }

    res.status(200).json({
      success: true,
      hasTricycle: true,
      tricycle: {
        _id: tricycle._id,
        plateNumber: tricycle.plateNumber,
        bodyNumber: tricycle.bodyNumber,
        boundary: tricycle.boundary || { amount: 0, settlementType: 'daily' }
      },
      operator: tricycle.operator ? {
        _id: tricycle.operator._id,
        name: `${tricycle.operator.firstname} ${tricycle.operator.lastname}`,
        phone: tricycle.operator.phone
      } : null,
      pendingSettlements,
      recentSettlements,
      summary: {
        totalPending,
        totalAwaitingConfirmation,
        pendingCount: pendingSettlements.filter(s => s.status === 'pending').length,
        awaitingConfirmationCount: pendingSettlements.filter(s => s.status === 'paid').length,
        outstandingBalance,
        daysSinceLastSettlement,
        lastSettledDate
      }
    });

  } catch (error) {
    console.error('Error getting driver boundary info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get boundary info',
      error: error.message
    });
  }
};

/**
 * Driver settles boundary payment
 * POST /api/boundary/settle
 */
export const settlePayment = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { amount, settlementType, periodStart, periodEnd, paymentMethod, referenceNumber, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    // Find tricycle assigned to driver
    const tricycle = await Tricycle.findOne({ driver: driverId })
      .populate('operator', 'firstname lastname');

    if (!tricycle) {
      return res.status(404).json({
        success: false,
        message: 'No tricycle assigned to you'
      });
    }

    if (!tricycle.operator) {
      return res.status(400).json({
        success: false,
        message: 'No operator linked to your tricycle'
      });
    }

    // Create settlement record
    const settlement = new BoundarySettlement({
      driver: driverId,
      operator: tricycle.operator._id,
      tricycle: tricycle._id,
      amount,
      settlementType: settlementType || tricycle.boundary?.settlementType || 'daily',
      periodStart: periodStart || new Date(),
      periodEnd: periodEnd || new Date(),
      status: 'paid',
      paidAt: new Date(),
      paymentMethod: paymentMethod || 'cash',
      referenceNumber,
      notes
    });

    await settlement.save();

    // Update tricycle's last settled date
    tricycle.boundary = tricycle.boundary || {};
    tricycle.boundary.lastSettledAt = new Date();
    await tricycle.save();

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully. Awaiting operator confirmation.',
      settlement
    });

  } catch (error) {
    console.error('Error settling payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message
    });
  }
};

/**
 * Get operator's boundary settlements overview
 * GET /api/boundary/operator-overview
 */
export const getOperatorOverview = async (req, res) => {
  try {
    const operatorId = req.user.id;

    // Get all tricycles owned by operator
    const tricycles = await Tricycle.find({ operator: operatorId })
      .populate('driver', 'firstname lastname phone image')
      .select('plateNumber bodyNumber boundary driver status');

    // Get all pending/paid settlements for operator
    const pendingSettlements = await BoundarySettlement.find({
      operator: operatorId,
      status: { $in: ['pending', 'paid'] }
    })
      .populate('driver', 'firstname lastname phone image')
      .populate('tricycle', 'plateNumber bodyNumber')
      .sort({ paidAt: -1, createdAt: -1 });

    // Get recent confirmed settlements
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSettlements = await BoundarySettlement.find({
      operator: operatorId,
      status: 'confirmed',
      confirmedAt: { $gte: thirtyDaysAgo }
    })
      .populate('driver', 'firstname lastname')
      .populate('tricycle', 'plateNumber bodyNumber')
      .sort({ confirmedAt: -1 })
      .limit(20);

    // Calculate totals
    const totalPendingConfirmation = pendingSettlements
      .filter(s => s.status === 'paid')
      .reduce((sum, s) => sum + s.amount, 0);

    const totalConfirmedThisMonth = recentSettlements
      .reduce((sum, s) => sum + s.amount, 0);

    // Expected daily income
    const expectedDaily = tricycles
      .filter(t => t.driver && t.boundary?.amount)
      .reduce((sum, t) => sum + (t.boundary?.amount || 0), 0);

    res.status(200).json({
      success: true,
      tricycles,
      pendingSettlements,
      recentSettlements,
      summary: {
        totalTricycles: tricycles.length,
        assignedTricycles: tricycles.filter(t => t.driver).length,
        pendingConfirmationCount: pendingSettlements.filter(s => s.status === 'paid').length,
        totalPendingConfirmation,
        totalConfirmedThisMonth,
        expectedDailyIncome: expectedDaily,
        expectedWeeklyIncome: expectedDaily * 7
      }
    });

  } catch (error) {
    console.error('Error getting operator overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get overview',
      error: error.message
    });
  }
};

/**
 * Operator confirms a settlement
 * PUT /api/boundary/confirm/:settlementId
 */
export const confirmSettlement = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { settlementId } = req.params;

    const settlement = await BoundarySettlement.findById(settlementId);

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    if (settlement.operator.toString() !== operatorId) {
      return res.status(403).json({
        success: false,
        message: 'You can only confirm your own settlements'
      });
    }

    if (settlement.status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Only paid settlements can be confirmed'
      });
    }

    settlement.status = 'confirmed';
    settlement.confirmedAt = new Date();
    settlement.confirmedBy = operatorId;

    await settlement.save();

    // Update tricycle's last settled date
    await Tricycle.findByIdAndUpdate(settlement.tricycle, {
      'boundary.lastSettledAt': new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Settlement confirmed',
      settlement
    });

  } catch (error) {
    console.error('Error confirming settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm settlement',
      error: error.message
    });
  }
};

/**
 * Operator disputes a settlement
 * PUT /api/boundary/dispute/:settlementId
 */
export const disputeSettlement = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { settlementId } = req.params;
    const { reason } = req.body;

    const settlement = await BoundarySettlement.findById(settlementId);

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    if (settlement.operator.toString() !== operatorId) {
      return res.status(403).json({
        success: false,
        message: 'You can only dispute your own settlements'
      });
    }

    settlement.status = 'disputed';
    settlement.notes = (settlement.notes || '') + `\n[DISPUTED]: ${reason || 'No reason provided'}`;

    await settlement.save();

    res.status(200).json({
      success: true,
      message: 'Settlement disputed',
      settlement
    });

  } catch (error) {
    console.error('Error disputing settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dispute settlement',
      error: error.message
    });
  }
};

/**
 * Get settlement history
 * GET /api/boundary/history
 */
export const getSettlementHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const { page = 1, limit = 20 } = req.query;

    let query = {};
    if (user.role === 'driver') {
      query.driver = userId;
    } else if (user.role === 'operator') {
      query.operator = userId;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const settlements = await BoundarySettlement.find(query)
      .populate('driver', 'firstname lastname')
      .populate('operator', 'firstname lastname')
      .populate('tricycle', 'plateNumber bodyNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await BoundarySettlement.countDocuments(query);

    res.status(200).json({
      success: true,
      settlements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error getting settlement history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get history',
      error: error.message
    });
  }
};

import Violation, { WEBTTODA_RULES, COMPLAINT_TO_RULE_MAPPING } from '../models/violationModel.js';
import User from '../models/userModel.js';
import Complaint from '../models/complaintModel.js';
import Tricycle from '../models/tricycleModel.js';
import AdminActivityLog from '../models/adminActivityLogModel.js';
import { sendNotification } from '../utils/firebase.js';

/**
 * Violation Controller
 * 
 * Handles WEBTTODA rules-based violation management with:
 * - Progressive discipline system
 * - Auto-escalation for repeated offenses
 * - Complaint-to-violation conversion
 * - Driver violation history tracking
 */

/**
 * Get the next penalty for a rule based on offense count
 */
const getNextPenalty = (ruleNumber, offenseCount) => {
  const rule = WEBTTODA_RULES[ruleNumber];
  if (!rule) return null;
  
  const penaltyIndex = Math.min(offenseCount, rule.penalties.length - 1);
  return rule.penalties[penaltyIndex];
};

/**
 * Apply suspension to driver
 */
const applySuspension = async (driver, days, reason, adminId) => {
  const suspendedUntil = new Date();
  suspendedUntil.setDate(suspendedUntil.getDate() + days);
  
  driver.isSuspended = true;
  driver.suspendedUntil = suspendedUntil;
  driver.suspensionReason = reason;
  
  driver.suspensionHistory.push({
    suspendedAt: new Date(),
    suspendedUntil: suspendedUntil,
    reason: reason,
    suspendedBy: adminId,
  });
  
  await driver.save();
  
  // Notify driver
  if (driver.FCMToken) {
    await sendNotification(
      driver.FCMToken,
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
  
  return suspendedUntil;
};

/**
 * Notify driver's operator about violation
 */
const notifyOperator = async (violation, driver) => {
  try {
    const tricycle = await Tricycle.findOne({ driver: driver._id })
      .populate('operator', 'FCMToken firstname lastname');
    
    if (tricycle?.operator?.FCMToken) {
      await sendNotification(
        tricycle.operator.FCMToken,
        '⚠️ Driver Violation Recorded',
        `${driver.firstname} ${driver.lastname} has received a violation: ${violation.ruleDetails.rule}`,
        {
          type: 'violation',
          violationId: violation._id.toString(),
          driverId: driver._id.toString(),
          action: violation.penalty.action,
        }
      );
      
      violation.operatorNotified = true;
      violation.operatorNotifiedAt = new Date();
      await violation.save();
    }
  } catch (error) {
    console.error('Error notifying operator:', error);
  }
};

/**
 * Create violation from complaint
 * Called when a complaint is resolved with action taken
 */
export const createViolationFromComplaint = async (complaint, adminId) => {
  try {
    const ruleNumber = COMPLAINT_TO_RULE_MAPPING[complaint.category] || 5;
    const rule = WEBTTODA_RULES[ruleNumber];
    
    if (!rule) {
      throw new Error(`Invalid rule number: ${ruleNumber}`);
    }
    
    // Get current offense count for this rule
    const existingOffenseCount = await Violation.getOffenseCount(complaint.driver, ruleNumber);
    const offenseNumber = existingOffenseCount + 1;
    
    // Get the appropriate penalty
    const penalty = getNextPenalty(ruleNumber, existingOffenseCount);
    
    // Create the violation record
    const violation = new Violation({
      driver: complaint.driver,
      ruleNumber: ruleNumber,
      ruleDetails: {
        category: rule.category,
        categoryName: rule.categoryName,
        rule: rule.rule,
        offense: rule.offense,
      },
      offenseNumber: offenseNumber,
      source: 'complaint',
      relatedComplaint: complaint._id,
      description: `Violation from complaint: ${complaint.category}. ${complaint.description?.substring(0, 200)}`,
      penalty: {
        action: penalty.action,
        days: penalty.days,
        label: penalty.label,
        appliedAt: new Date(),
        appliedBy: adminId,
      },
      status: 'confirmed',
      incidentDate: complaint.incidentDate || complaint.createdAt,
      createdBy: adminId,
    });
    
    await violation.save();
    
    // Apply the penalty
    const driver = await User.findById(complaint.driver);
    if (driver) {
      if (penalty.action === 'suspension' && penalty.days > 0) {
        await applySuspension(driver, penalty.days, `${rule.rule} - ${offenseNumber}${getOrdinalSuffix(offenseNumber)} offense`, adminId);
      } else if (penalty.action === 'dismissal') {
        // For dismissal, suspend for a very long period (10 years)
        await applySuspension(driver, 3650, `DISMISSED: ${rule.rule}`, adminId);
      }
      
      // Notify operator
      await notifyOperator(violation, driver);
      
      // Notify driver
      if (driver.FCMToken) {
        await sendNotification(
          driver.FCMToken,
          penalty.action === 'warning' ? '⚠️ Warning Issued' : penalty.action === 'dismissal' ? '🚫 Dismissal Notice' : '⚠️ Violation Recorded',
          `${rule.rule} - ${penalty.label}`,
          {
            type: 'violation',
            violationId: violation._id.toString(),
            action: penalty.action,
          }
        );
      }
    }
    
    // Check for auto-escalation (3 warnings or 3 suspensions rule)
    const escalation = await Violation.checkAutoEscalation(complaint.driver);
    if (escalation.escalate) {
      await handleAutoEscalation(complaint.driver, escalation, adminId);
    }
    
    return violation;
  } catch (error) {
    console.error('Error creating violation from complaint:', error);
    throw error;
  }
};

/**
 * Handle auto-escalation for repeated violations
 */
const handleAutoEscalation = async (driverId, escalation, adminId) => {
  const rule = WEBTTODA_RULES[escalation.rule];
  const penalty = rule.penalties[0];
  
  const violation = new Violation({
    driver: driverId,
    ruleNumber: escalation.rule,
    ruleDetails: {
      category: rule.category,
      categoryName: rule.categoryName,
      rule: rule.rule,
      offense: rule.offense,
    },
    offenseNumber: 1,
    source: 'system_detected',
    description: `Auto-escalation: ${escalation.reason}`,
    penalty: {
      action: penalty.action,
      days: penalty.days,
      label: penalty.label,
      appliedAt: new Date(),
      appliedBy: adminId,
    },
    status: 'confirmed',
    incidentDate: new Date(),
    createdBy: adminId,
    adminNotes: [{
      note: `System auto-escalation triggered: ${escalation.reason}`,
      addedAt: new Date(),
    }],
  });
  
  await violation.save();
  
  const driver = await User.findById(driverId);
  if (driver) {
    if (penalty.action === 'suspension') {
      await applySuspension(driver, penalty.days, `${escalation.reason} - Auto-escalated`, adminId);
    } else if (penalty.action === 'dismissal') {
      await applySuspension(driver, 3650, `DISMISSED: ${escalation.reason}`, adminId);
    }
    
    await notifyOperator(violation, driver);
  }
  
  return violation;
};

/**
 * Helper: Get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
const getOrdinalSuffix = (num) => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
};

/**
 * Create a new violation manually (admin)
 * POST /api/violations
 */
export const createViolation = async (req, res) => {
  try {
    const { driverId, ruleNumber, description, incidentDate, evidence } = req.body;
    const adminUser = req.user;
    
    // Validate rule
    const rule = WEBTTODA_RULES[ruleNumber];
    if (!rule) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rule number',
      });
    }
    
    // Validate driver
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }
    
    // Get current offense count
    const existingOffenseCount = await Violation.getOffenseCount(driverId, ruleNumber);
    const offenseNumber = existingOffenseCount + 1;
    
    // Get penalty
    const penalty = getNextPenalty(ruleNumber, existingOffenseCount);
    
    // Create violation
    const violation = new Violation({
      driver: driverId,
      ruleNumber: ruleNumber,
      ruleDetails: {
        category: rule.category,
        categoryName: rule.categoryName,
        rule: rule.rule,
        offense: rule.offense,
      },
      offenseNumber: offenseNumber,
      source: 'admin_report',
      description: description || rule.offense,
      evidence: evidence || [],
      penalty: {
        action: penalty.action,
        days: penalty.days,
        label: penalty.label,
        appliedAt: new Date(),
        appliedBy: adminUser._id,
      },
      status: 'confirmed',
      incidentDate: incidentDate ? new Date(incidentDate) : new Date(),
      createdBy: adminUser._id,
    });
    
    await violation.save();
    
    // Apply penalty
    if (penalty.action === 'suspension' && penalty.days > 0) {
      await applySuspension(driver, penalty.days, `${rule.rule} - ${offenseNumber}${getOrdinalSuffix(offenseNumber)} offense`, adminUser._id);
    } else if (penalty.action === 'dismissal') {
      await applySuspension(driver, 3650, `DISMISSED: ${rule.rule}`, adminUser._id);
    }
    
    // Notify
    await notifyOperator(violation, driver);
    
    if (driver.FCMToken) {
      await sendNotification(
        driver.FCMToken,
        penalty.action === 'warning' ? '⚠️ Warning Issued' : '⚠️ Violation Recorded',
        `${rule.rule} - ${penalty.label}`,
        { type: 'violation', violationId: violation._id.toString() }
      );
    }
    
    // Log admin activity
    await AdminActivityLog.logActivity({
      adminId: adminUser._id,
      adminEmail: adminUser.email,
      adminName: `${adminUser.firstname} ${adminUser.lastname}`,
      action: 'VIOLATION_CREATED',
      description: `Created violation for ${driver.email}: ${rule.rule} (${penalty.label})`,
      targetUserId: driver._id,
      targetUserEmail: driver.email,
      targetUserName: `${driver.firstname} ${driver.lastname}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    // Check auto-escalation
    const escalation = await Violation.checkAutoEscalation(driverId);
    if (escalation.escalate) {
      await handleAutoEscalation(driverId, escalation, adminUser._id);
    }
    
    res.status(201).json({
      success: true,
      message: `Violation recorded: ${penalty.label}`,
      violation: await violation.populate('driver', 'firstname lastname email'),
    });
  } catch (error) {
    console.error('Error creating violation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create violation',
      error: error.message,
    });
  }
};

/**
 * Get all violations (admin)
 * GET /api/violations
 */
export const getAllViolations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      driverId,
      ruleNumber,
      status,
      action,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;
    
    const filter = {};
    
    if (driverId) filter.driver = driverId;
    if (ruleNumber) filter.ruleNumber = parseInt(ruleNumber);
    if (status) filter.status = status;
    if (action) filter['penalty.action'] = action;
    if (category) filter['ruleDetails.category'] = category;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    
    const [violations, total] = await Promise.all([
      Violation.find(filter)
        .populate('driver', 'firstname lastname email image rating')
        .populate('createdBy', 'firstname lastname')
        .populate('relatedComplaint', 'category status')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Violation.countDocuments(filter),
    ]);
    
    // Get statistics
    const stats = await Violation.aggregate([
      {
        $facet: {
          byAction: [
            { $group: { _id: '$penalty.action', count: { $sum: 1 } } },
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ],
          byCategory: [
            { $group: { _id: '$ruleDetails.category', count: { $sum: 1 } } },
          ],
          recent: [
            { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
            { $count: 'count' },
          ],
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      violations,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
      stats: {
        byAction: stats[0].byAction,
        byStatus: stats[0].byStatus,
        byCategory: stats[0].byCategory,
        recentCount: stats[0].recent[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching violations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch violations',
      error: error.message,
    });
  }
};

/**
 * Get driver violation history
 * GET /api/violations/driver/:driverId
 */
export const getDriverViolations = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { withinMonths = 12 } = req.query;
    
    const dateThreshold = new Date();
    dateThreshold.setMonth(dateThreshold.getMonth() - parseInt(withinMonths));
    
    const violations = await Violation.find({
      driver: driverId,
      incidentDate: { $gte: dateThreshold },
    })
      .populate('relatedComplaint', 'category status')
      .populate('createdBy', 'firstname lastname')
      .sort({ incidentDate: -1 })
      .lean();
    
    const stats = await Violation.getDriverViolationStats(driverId, parseInt(withinMonths));
    const escalationCheck = await Violation.checkAutoEscalation(driverId);
    
    // Group by rule
    const byRule = {};
    violations.forEach(v => {
      if (!byRule[v.ruleNumber]) {
        byRule[v.ruleNumber] = {
          rule: v.ruleDetails,
          count: 0,
          violations: [],
        };
      }
      byRule[v.ruleNumber].count++;
      byRule[v.ruleNumber].violations.push(v);
    });
    
    res.status(200).json({
      success: true,
      violations,
      stats,
      byRule,
      escalationStatus: escalationCheck,
      withinMonths: parseInt(withinMonths),
    });
  } catch (error) {
    console.error('Error fetching driver violations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver violations',
      error: error.message,
    });
  }
};

/**
 * Get violation details
 * GET /api/violations/:id
 */
export const getViolationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const violation = await Violation.findById(id)
      .populate('driver', 'firstname lastname email image rating phone')
      .populate('createdBy', 'firstname lastname email')
      .populate('relatedComplaint')
      .populate('adminNotes.addedBy', 'firstname lastname')
      .populate('appeal.appealDecisionBy', 'firstname lastname');
    
    if (!violation) {
      return res.status(404).json({
        success: false,
        message: 'Violation not found',
      });
    }
    
    // Get driver's violation history for context
    const driverStats = await Violation.getDriverViolationStats(violation.driver._id);
    
    res.status(200).json({
      success: true,
      violation,
      driverStats,
    });
  } catch (error) {
    console.error('Error fetching violation details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch violation details',
      error: error.message,
    });
  }
};

/**
 * Update violation status
 * PUT /api/violations/:id/status
 */
export const updateViolationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const adminUser = req.user;
    
    const violation = await Violation.findById(id);
    if (!violation) {
      return res.status(404).json({
        success: false,
        message: 'Violation not found',
      });
    }
    
    const previousStatus = violation.status;
    violation.status = status;
    
    if (note) {
      violation.adminNotes.push({
        note: `Status changed from ${previousStatus} to ${status}: ${note}`,
        addedBy: adminUser._id,
        addedAt: new Date(),
      });
    }
    
    await violation.save();
    
    // If overturned, lift suspension if applicable
    if (status === 'overturned' && violation.penalty.action === 'suspension') {
      const driver = await User.findById(violation.driver);
      if (driver && driver.isSuspended) {
        driver.isSuspended = false;
        driver.suspendedUntil = null;
        driver.suspensionReason = null;
        await driver.save();
        
        if (driver.FCMToken) {
          await sendNotification(
            driver.FCMToken,
            '✅ Violation Overturned',
            'Your violation has been overturned and suspension lifted.',
            { type: 'violation_overturned' }
          );
        }
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Violation status updated to ${status}`,
      violation,
    });
  } catch (error) {
    console.error('Error updating violation status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update violation status',
      error: error.message,
    });
  }
};

/**
 * Process appeal
 * PUT /api/violations/:id/appeal
 */
export const processAppeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, notes, reducedDays } = req.body;
    const adminUser = req.user;
    
    const violation = await Violation.findById(id).populate('driver');
    if (!violation) {
      return res.status(404).json({
        success: false,
        message: 'Violation not found',
      });
    }
    
    if (!violation.appeal.isAppealed) {
      return res.status(400).json({
        success: false,
        message: 'This violation has not been appealed',
      });
    }
    
    violation.appeal.appealDecision = decision;
    violation.appeal.appealDecisionBy = adminUser._id;
    violation.appeal.appealDecisionAt = new Date();
    violation.appeal.appealNotes = notes;
    
    if (decision === 'overturned') {
      violation.status = 'overturned';
      
      // Lift suspension
      const driver = violation.driver;
      if (driver.isSuspended) {
        driver.isSuspended = false;
        driver.suspendedUntil = null;
        driver.suspensionReason = null;
        await driver.save();
      }
    } else if (decision === 'reduced' && reducedDays) {
      // Reduce suspension
      violation.penalty.days = reducedDays;
      
      const driver = violation.driver;
      if (driver.isSuspended) {
        const newSuspendedUntil = new Date();
        newSuspendedUntil.setDate(newSuspendedUntil.getDate() + reducedDays);
        driver.suspendedUntil = newSuspendedUntil;
        await driver.save();
      }
    }
    
    violation.adminNotes.push({
      note: `Appeal ${decision}: ${notes || 'No additional notes'}`,
      addedBy: adminUser._id,
      addedAt: new Date(),
    });
    
    await violation.save();
    
    // Notify driver
    if (violation.driver.FCMToken) {
      const message = decision === 'upheld' 
        ? 'Your appeal has been reviewed and the original decision stands.'
        : decision === 'overturned'
        ? 'Your appeal has been approved and the violation has been overturned.'
        : `Your appeal has been partially approved. Suspension reduced to ${reducedDays} days.`;
      
      await sendNotification(
        violation.driver.FCMToken,
        `📋 Appeal Decision: ${decision.charAt(0).toUpperCase() + decision.slice(1)}`,
        message,
        { type: 'appeal_decision', violationId: violation._id.toString() }
      );
    }
    
    res.status(200).json({
      success: true,
      message: `Appeal ${decision}`,
      violation,
    });
  } catch (error) {
    console.error('Error processing appeal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process appeal',
      error: error.message,
    });
  }
};

/**
 * Get WEBTTODA rules reference
 * GET /api/violations/rules
 */
export const getRulesReference = async (req, res) => {
  try {
    const rulesArray = Object.entries(WEBTTODA_RULES).map(([id, rule]) => ({
      id: parseInt(id),
      ...rule,
    }));
    
    // Group by category
    const byCategory = {};
    rulesArray.forEach(rule => {
      if (!byCategory[rule.category]) {
        byCategory[rule.category] = {
          categoryName: rule.categoryName,
          rules: [],
        };
      }
      byCategory[rule.category].rules.push(rule);
    });
    
    res.status(200).json({
      success: true,
      rules: rulesArray,
      byCategory,
      complaintMapping: COMPLAINT_TO_RULE_MAPPING,
    });
  } catch (error) {
    console.error('Error fetching rules reference:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rules reference',
      error: error.message,
    });
  }
};

/**
 * Get violation statistics for dashboard
 * GET /api/violations/stats
 */
export const getViolationStats = async (req, res) => {
  try {
    const { period = 30 } = req.query;
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - parseInt(period));
    
    const stats = await Violation.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          recent: [
            { $match: { createdAt: { $gte: dateThreshold } } },
            { $count: 'count' },
          ],
          byAction: [
            { $group: { _id: '$penalty.action', count: { $sum: 1 } } },
          ],
          byCategory: [
            { $group: { _id: '$ruleDetails.categoryName', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byRule: [
            { $group: { _id: '$ruleNumber', count: { $sum: 1 }, rule: { $first: '$ruleDetails.rule' } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          monthlyTrend: [
            {
              $match: {
                createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 12)) },
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
          driversWithMostViolations: [
            { $group: { _id: '$driver', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'driverInfo',
              },
            },
            { $unwind: '$driverInfo' },
            {
              $project: {
                count: 1,
                'driverInfo.firstname': 1,
                'driverInfo.lastname': 1,
                'driverInfo.email': 1,
              },
            },
          ],
          pendingAppeals: [
            { $match: { 'appeal.isAppealed': true, 'appeal.appealDecision': 'pending' } },
            { $count: 'count' },
          ],
        },
      },
    ]);
    
    const result = stats[0];
    
    res.status(200).json({
      success: true,
      stats: {
        total: result.total[0]?.count || 0,
        recent: result.recent[0]?.count || 0,
        recentPeriodDays: parseInt(period),
        byAction: result.byAction,
        byCategory: result.byCategory,
        topRules: result.byRule,
        monthlyTrend: result.monthlyTrend,
        driversWithMostViolations: result.driversWithMostViolations,
        pendingAppeals: result.pendingAppeals[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching violation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch violation statistics',
      error: error.message,
    });
  }
};

/**
 * Get my violations (for drivers to view their own violations)
 * GET /api/violations/my-violations
 */
export const getMyViolations = async (req, res) => {
  try {
    const driverId = req.user._id;
    const { page = 1, limit = 20, status } = req.query;
    
    // Verify user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Only drivers can access their violations',
      });
    }
    
    const filter = { driver: driverId };
    if (status) filter.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [violations, total] = await Promise.all([
      Violation.find(filter)
        .populate('relatedComplaint', 'category status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Violation.countDocuments(filter),
    ]);
    
    // Get summary stats
    const stats = await Violation.getDriverViolationStats(driverId);
    const escalationCheck = await Violation.checkAutoEscalation(driverId);
    
    res.status(200).json({
      success: true,
      violations,
      stats,
      escalationWarning: escalationCheck.warningCount >= 2 || escalationCheck.suspensionCount >= 2 
        ? `Warning: You have ${escalationCheck.warningCount} warnings and ${escalationCheck.suspensionCount} suspensions in the past 12 months. 3 of either results in escalation.`
        : null,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Error fetching my violations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your violations',
      error: error.message,
    });
  }
};

/**
 * Submit appeal for a violation (for drivers)
 * POST /api/violations/:id/submit-appeal
 */
export const submitAppeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { appealReason, supportingDetails } = req.body;
    const driverId = req.user._id;
    
    // Verify user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Only drivers can submit appeals',
      });
    }
    
    const violation = await Violation.findById(id);
    
    if (!violation) {
      return res.status(404).json({
        success: false,
        message: 'Violation not found',
      });
    }
    
    // Verify this violation belongs to the driver
    if (violation.driver.toString() !== driverId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only appeal your own violations',
      });
    }
    
    // Check if already appealed
    if (violation.appeal.isAppealed) {
      return res.status(400).json({
        success: false,
        message: 'This violation has already been appealed',
        currentDecision: violation.appeal.appealDecision,
      });
    }
    
    // Check if violation is within appeal window (7 days from incident date)
    const appealDeadline = new Date(violation.incidentDate);
    appealDeadline.setDate(appealDeadline.getDate() + 7);
    
    if (new Date() > appealDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Appeal window has closed. Appeals must be submitted within 7 days of the incident.',
      });
    }
    
    // Validate appeal reason
    if (!appealReason || appealReason.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a detailed appeal reason (at least 50 characters)',
      });
    }
    
    // Submit the appeal
    violation.appeal = {
      isAppealed: true,
      appealReason: appealReason.trim(),
      appealedAt: new Date(),
      appealDecision: 'pending',
      supportingDetails: supportingDetails || '',
    };
    
    violation.status = 'appealed';
    
    violation.adminNotes.push({
      note: `Driver submitted appeal: ${appealReason.substring(0, 100)}...`,
      addedAt: new Date(),
    });
    
    await violation.save();
    
    // Notify admins about the appeal (you can add FCM notification here)
    // For now, just log it
    console.log(`Violation appeal submitted: ${violation._id} by driver ${driverId}`);
    
    res.status(200).json({
      success: true,
      message: 'Appeal submitted successfully. You will be notified of the decision.',
      violation: {
        _id: violation._id,
        ruleNumber: violation.ruleNumber,
        ruleDetails: violation.ruleDetails,
        penalty: violation.penalty,
        appeal: violation.appeal,
        status: violation.status,
      },
    });
  } catch (error) {
    console.error('Error submitting appeal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit appeal',
      error: error.message,
    });
  }
};

export default {
  createViolation,
  createViolationFromComplaint,
  getAllViolations,
  getDriverViolations,
  getViolationDetails,
  updateViolationStatus,
  processAppeal,
  getRulesReference,
  getViolationStats,
  getMyViolations,
  submitAppeal,
};

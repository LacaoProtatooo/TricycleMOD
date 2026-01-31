import mongoose from 'mongoose';
import Complaint from '../models/complaintModel.js';
import User from '../models/userModel.js';
import Booking from '../models/bookingModel.js';
import Tricycle from '../models/tricycleModel.js';
import cloudinary from '../utils/cloudinaryConfig.js';
import { messaging } from '../utils/firebase.js';
import { analyzeComplaint, analyzeSentiment } from '../utils/sentimentAnalysis.js';
import { detectBodyNumber, formatBodyNumber } from '../utils/bodyNumberOCR.js';
import { createViolationFromComplaint } from './violationController.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Complaint Controller
 * 
 * Handles complaint filing with anti-abuse measures:
 * - Rate limiting
 * - Required evidence verification
 * - Credibility scoring
 * - Admin management workflows
 * - Notification to admin and operators
 * - Automation features
 */

// Severity levels for categories (for automation)
const SEVERITY_LEVELS = {
  harassment: 'critical',
  intoxicated_driving: 'critical',
  discrimination: 'critical',
  unsafe_driving: 'high',
  overcharging: 'medium',
  rude_behavior: 'medium',
  refusal_of_service: 'medium',
  route_deviation: 'low',
  vehicle_condition: 'low',
  other: 'low',
};

// Auto-suspension thresholds
const COMPLAINT_THRESHOLDS = {
  WARNING: 3,           // 3 complaints = warning
  SUSPENSION_TEMP: 5,   // 5 complaints = temporary suspension
  SUSPENSION_LONG: 8,   // 8 complaints = longer suspension
  TERMINATION: 10,      // 10 complaints = termination review
};

/**
 * Send push notification to the driver's operator
 */
const notifyDriverOperator = async (complaint, complainant, driver) => {
  try {
    // Find the tricycle assigned to this driver to get the operator
    const tricycle = await Tricycle.findOne({ driver: driver._id })
      .populate('operator', 'FCMToken firstname lastname');
    
    if (!tricycle || !tricycle.operator) {
      console.log('No operator found for driver:', driver._id);
      return null;
    }
    
    const operator = tricycle.operator;
    
    if (!operator.FCMToken) {
      console.log('Operator has no FCM token:', operator._id);
      return null;
    }
    
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
    
    const severity = SEVERITY_LEVELS[complaint.category];
    const severityEmoji = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : '📋';
    
    const title = `${severityEmoji} Complaint Against Your Driver`;
    const body = `Your driver ${driver.firstname} ${driver.lastname} received a complaint for ${categoryLabels[complaint.category] || complaint.category}. Please review.`;
    
    if (messaging) {
      const message = {
        notification: {
          title,
          body,
        },
        data: {
          type: 'driver_complaint',
          complaintId: complaint._id.toString(),
          category: complaint.category,
          driverId: driver._id.toString(),
          severity,
        },
        token: operator.FCMToken,
      };
      
      await messaging.send(message);
      console.log(`📱 Operator ${operator.firstname} notified about driver complaint`);
    }
    
    return operator._id;
  } catch (error) {
    console.error('Error notifying operator:', error);
    return null;
  }
};

/**
 * Send push notification to admins
 */
const notifyAdmins = async (complaint, complainant, driver, isAutoEscalated = false) => {
  try {
    // Get all admins with FCM tokens
    const admins = await User.find({
      role: 'admin',
      FCMToken: { $exists: true, $ne: null },
    }).select('FCMToken firstname');
    
    if (admins.length === 0) {
      console.log('No admins with FCM tokens to notify');
      return;
    }
    
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
    
    const severity = SEVERITY_LEVELS[complaint.category];
    let title = '🚨 New Driver Complaint';
    
    if (isAutoEscalated) {
      title = '🔴 URGENT: Auto-Escalated Complaint';
    } else if (severity === 'critical') {
      title = '🚨 CRITICAL: Severe Complaint Filed';
    }
    
    const body = `${complainant.firstname} filed a complaint against ${driver.firstname} ${driver.lastname} for ${categoryLabels[complaint.category] || complaint.category}`;
    
    const tokens = admins.map(r => r.FCMToken).filter(Boolean);
    
    if (tokens.length > 0 && messaging) {
      const message = {
        notification: {
          title,
          body,
        },
        data: {
          type: 'complaint',
          complaintId: complaint._id.toString(),
          category: complaint.category,
          driverId: driver._id.toString(),
          severity,
          autoEscalated: isAutoEscalated.toString(),
        },
        tokens,
      };
      
      const response = await messaging.sendEachForMulticast(message);
      console.log(`📱 Admin complaint notification sent: ${response.successCount}/${tokens.length} successful`);
    }
  } catch (error) {
    console.error('Error sending admin notifications:', error);
  }
};

/**
 * Notify driver about the complaint
 */
const notifyDriver = async (complaint, driver, severity) => {
  try {
    if (!driver.FCMToken) {
      console.log('Driver has no FCM token:', driver._id);
      return;
    }
    
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
    
    const title = '⚠️ Complaint Received';
    const body = `A complaint has been filed against you for ${categoryLabels[complaint.category]}. This is being reviewed by admin.`;
    
    if (messaging) {
      const message = {
        notification: {
          title,
          body,
        },
        data: {
          type: 'complaint_received',
          complaintId: complaint._id.toString(),
          category: complaint.category,
        },
        token: driver.FCMToken,
      };
      
      await messaging.send(message);
      console.log(`📱 Driver ${driver.firstname} notified about complaint`);
    }
  } catch (error) {
    console.error('Error notifying driver:', error);
  }
};

/**
 * Automation: Check driver complaint history and take action
 */
const checkDriverComplaintHistory = async (driverId) => {
  try {
    // Count total valid complaints against this driver (excluding dismissed/withdrawn)
    const complaintCount = await Complaint.countDocuments({
      driver: driverId,
      status: { $nin: ['dismissed', 'withdrawn'] },
      isFalseComplaint: false,
    });
    
    // Count critical complaints
    const criticalCount = await Complaint.countDocuments({
      driver: driverId,
      category: { $in: ['harassment', 'intoxicated_driving', 'discrimination'] },
      status: { $nin: ['dismissed', 'withdrawn'] },
      isFalseComplaint: false,
    });
    
    // Count complaints in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentComplaintCount = await Complaint.countDocuments({
      driver: driverId,
      createdAt: { $gte: thirtyDaysAgo },
      status: { $nin: ['dismissed', 'withdrawn'] },
      isFalseComplaint: false,
    });
    
    let action = null;
    let reason = '';
    
    // Determine action based on thresholds
    if (complaintCount >= COMPLAINT_THRESHOLDS.TERMINATION || criticalCount >= 3) {
      action = 'termination_review';
      reason = `Driver has ${complaintCount} total complaints (${criticalCount} critical). Immediate review required.`;
    } else if (complaintCount >= COMPLAINT_THRESHOLDS.SUSPENSION_LONG || criticalCount >= 2) {
      action = 'suspension_recommended';
      reason = `Driver has ${complaintCount} complaints. Suspension recommended.`;
    } else if (complaintCount >= COMPLAINT_THRESHOLDS.SUSPENSION_TEMP || recentComplaintCount >= 3) {
      action = 'warning_issued';
      reason = `Driver has ${recentComplaintCount} complaints in the last 30 days.`;
    } else if (complaintCount >= COMPLAINT_THRESHOLDS.WARNING) {
      action = 'monitoring';
      reason = `Driver has ${complaintCount} complaints. Added to monitoring list.`;
    }
    
    return {
      complaintCount,
      criticalCount,
      recentComplaintCount,
      action,
      reason,
    };
  } catch (error) {
    console.error('Error checking driver complaint history:', error);
    return null;
  }
};

/**
 * Automation: Auto-escalate severe complaints
 */
const autoEscalateIfNeeded = async (complaint, driver) => {
  const severity = SEVERITY_LEVELS[complaint.category];
  
  // Auto-escalate critical complaints
  if (severity === 'critical') {
    complaint.status = 'under_review';
    complaint.adminNotes.push({
      note: `⚡ AUTO-ESCALATED: This complaint was automatically escalated due to its critical nature (${complaint.category}).`,
      addedAt: new Date(),
    });
    await complaint.save();
    return true;
  }
  
  // Check if driver has pattern of complaints
  const history = await checkDriverComplaintHistory(driver._id);
  
  if (history && (history.action === 'termination_review' || history.action === 'suspension_recommended')) {
    complaint.status = 'under_review';
    complaint.adminNotes.push({
      note: `⚡ AUTO-ESCALATED: Driver has ${history.complaintCount} total complaints. ${history.reason}`,
      addedAt: new Date(),
    });
    await complaint.save();
    return true;
  }
  
  return false;
};

/**
 * Check if user can file a complaint
 * GET /api/complaints/can-file
 */
export const canFileComplaint = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await Complaint.canUserFileComplaint(userId);
    
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error checking complaint eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check complaint eligibility',
      error: error.message,
    });
  }
};

/**
 * Get drivers list for complaint filing
 * GET /api/complaints/drivers
 */
export const getDriversForComplaint = async (req, res) => {
  try {
    const { search } = req.query;
    const query = { role: 'driver', isVerified: true };
    
    if (search) {
      query.$or = [
        { firstname: { $regex: search, $options: 'i' } },
        { lastname: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }
    
    const drivers = await User.find(query)
      .select('firstname lastname username image rating')
      .limit(20)
      .sort({ firstname: 1 });
    
    res.status(200).json({
      success: true,
      drivers,
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers',
      error: error.message,
    });
  }
};

/**
 * Analyze complaint sentiment before submission
 * POST /api/complaints/analyze-sentiment
 * 
 * This endpoint allows users to preview sentiment analysis 
 * before submitting their complaint, providing feedback on 
 * description quality and urgency.
 */
export const analyzeComplaintSentiment = async (req, res) => {
  try {
    const { description, category } = req.body;
    
    if (!description || description.length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a description with at least 20 characters',
      });
    }
    
    // Run sentiment analysis
    const analysis = await analyzeComplaint(description, category || 'other');
    
    // Generate user-friendly feedback (Taglish support)
    let feedback = {
      message: '',
      messageTl: '', // Tagalog translation
      tone: 'neutral',
      suggestions: [],
    };
    
    if (analysis.sentiment.sentiment === 'negative' && analysis.sentiment.confidence > 0.7) {
      feedback.message = 'We understand this was a frustrating experience. Your complaint will be prioritized for review.';
      feedback.messageTl = 'Naiintindihan namin na nakaka-frustrate ang karanasan mo. Uunahin ang iyong reklamo sa pagsusuri.';
      feedback.tone = 'empathetic';
    } else if (analysis.sentiment.sentiment === 'positive') {
      feedback.message = 'The tone of your description seems positive. Please ensure you\'ve accurately described the incident.';
      feedback.messageTl = 'Mukhang positibo ang tono ng iyong paglalarawan. Siguraduhing tama ang pagkakasulat ng pangyayari.';
      feedback.tone = 'advisory';
    } else {
      feedback.message = 'Thank you for providing a clear description of the incident.';
      feedback.messageTl = 'Salamat sa malinaw na paglalarawan ng pangyayari.';
      feedback.tone = 'neutral';
    }
    
    feedback.suggestions = analysis.validation.suggestions;
    
    // Check if Taglish was detected
    const isTaglish = analysis.sentiment.isTaglish || false;
    const detectedNegativeWords = analysis.sentiment.taglishIndicators?.negativeWords || [];
    
    res.status(200).json({
      success: true,
      analysis: {
        sentiment: analysis.sentiment.sentiment,
        confidence: Math.round(analysis.sentiment.confidence * 100),
        urgency: analysis.severity.urgency,
        severityScore: analysis.severity.severityScore,
        descriptionQuality: analysis.validation.qualityScore >= 70 ? 'good' : analysis.validation.qualityScore >= 40 ? 'fair' : 'needs_improvement',
        qualityScore: analysis.validation.qualityScore,
        isTaglish,
        detectedIndicators: detectedNegativeWords.length > 0 ? detectedNegativeWords.slice(0, 3) : [],
      },
      feedback,
      flags: {
        willBePrioritized: analysis.severity.flags.mayRequireImmediateAttention,
        emotionallyCharged: analysis.severity.flags.emotionallyCharged,
      },
    });
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze complaint',
      error: error.message,
    });
  }
};

/**
 * File a new complaint
 * POST /api/complaints
 */
export const fileComplaint = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Check if user can file a complaint
    const eligibility = await Complaint.canUserFileComplaint(userId);
    if (!eligibility.canFile) {
      return res.status(403).json({
        success: false,
        message: eligibility.reason,
        banEndsAt: eligibility.banEndsAt,
      });
    }
    
    const {
      driverId,
      bookingId,
      category,
      description,
      evidence, // Array of base64 images
      incidentDate,
      incidentLocation,
      tricycleDetails,
      contactInfo,
    } = req.body;
    
    // Validate required fields
    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'Please select the driver you want to file a complaint against',
      });
    }
    
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Please select a complaint category',
      });
    }
    
    if (!description || description.length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a detailed description (at least 50 characters)',
      });
    }
    
    if (!evidence || evidence.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one piece of evidence (photo) is required to file a complaint. This helps us verify your claim and take appropriate action.',
      });
    }
    
    if (!incidentDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the date when the incident occurred',
      });
    }
    
    // Verify driver exists
    const driver = await User.findOne({ _id: driverId, role: 'driver' });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }
    
    // Verify booking if provided
    let booking = null;
    if (bookingId) {
      booking = await Booking.findById(bookingId);
      if (booking && booking.user.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only reference your own bookings',
        });
      }
    }
    
    // Upload evidence to Cloudinary
    const uploadedEvidence = [];
    for (const item of evidence) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(item.uri || item, {
          folder: 'complaints',
          resource_type: 'auto',
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
          ],
        });
        
        uploadedEvidence.push({
          type: uploadResponse.resource_type === 'video' ? 'video' : 'image',
          public_id: uploadResponse.public_id,
          url: uploadResponse.secure_url,
        });
      } catch (uploadError) {
        console.error('Error uploading evidence:', uploadError);
        // Continue with other uploads
      }
    }
    
    if (uploadedEvidence.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to upload evidence. Please try again with valid image files.',
      });
    }
    
    // === SENTIMENT ANALYSIS ===
    // Analyze the complaint description for sentiment and severity
    let sentimentAnalysis = null;
    try {
      sentimentAnalysis = await analyzeComplaint(description, category);
      console.log(`🧠 Sentiment Analysis: ${sentimentAnalysis.sentiment.sentiment} (${(sentimentAnalysis.sentiment.confidence * 100).toFixed(1)}% confidence)`);
      console.log(`📊 Severity: ${sentimentAnalysis.severity.urgency} (${sentimentAnalysis.severity.severityScore}/5)`);
    } catch (sentimentError) {
      console.error('Sentiment analysis error (non-blocking):', sentimentError);
    }
    
    // Create the complaint
    const complaint = new Complaint({
      complainant: userId,
      complainantContact: contactInfo || {
        email: req.user.email,
        phone: req.user.phone,
      },
      driver: driverId,
      relatedBooking: bookingId || null,
      category,
      description,
      evidence: uploadedEvidence,
      incidentDate: new Date(incidentDate),
      incidentLocation: incidentLocation || {},
      tricycleDetails: tricycleDetails || {},
      submittedFromIP: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      // Sentiment analysis data
      sentimentAnalysis: sentimentAnalysis ? {
        sentiment: sentimentAnalysis.sentiment.sentiment,
        confidence: sentimentAnalysis.sentiment.confidence,
        scores: sentimentAnalysis.sentiment.scores,
        severityScore: sentimentAnalysis.severity.severityScore,
        urgency: sentimentAnalysis.severity.urgency,
        descriptionQuality: sentimentAnalysis.validation.qualityScore,
        flags: sentimentAnalysis.severity.flags,
        // Save detected Taglish indicator words for analysis
        taglishIndicators: {
          negativeWords: sentimentAnalysis.sentiment.taglishIndicators?.negativeWords || [],
          positiveWords: sentimentAnalysis.sentiment.taglishIndicators?.positiveWords || [],
          isTaglish: sentimentAnalysis.sentiment.isTaglish || false,
        },
        analyzedAt: new Date(),
      } : null,
    });
    
    // Auto-escalate based on sentiment if highly negative and critical category
    if (sentimentAnalysis?.severity?.flags?.mayRequireImmediateAttention) {
      complaint.adminNotes.push({
        note: `🧠 SENTIMENT ALERT: Highly negative sentiment detected (${(sentimentAnalysis.sentiment.confidence * 100).toFixed(1)}% confidence). Urgency: ${sentimentAnalysis.severity.urgency.toUpperCase()}`,
        addedAt: new Date(),
      });
    }
    
    await complaint.save();
    
    // === AUTOMATION & NOTIFICATIONS ===
    
    // 1. Check if complaint should be auto-escalated
    const wasAutoEscalated = await autoEscalateIfNeeded(complaint, driver);
    
    // 2. Check driver's complaint history for automated actions
    const driverHistory = await checkDriverComplaintHistory(driver._id);
    
    // 3. Notify the driver's specific operator
    const notifiedOperatorId = await notifyDriverOperator(complaint, req.user, driver);
    
    // 4. Notify all admins (with escalation flag if applicable)
    await notifyAdmins(complaint, req.user, driver, wasAutoEscalated);
    
    // 5. Notify the driver about the complaint
    await notifyDriver(complaint, driver, SEVERITY_LEVELS[complaint.category]);
    
    // 6. If driver history triggers action, add note to complaint
    if (driverHistory && driverHistory.action) {
      complaint.adminNotes.push({
        note: `📊 DRIVER HISTORY: ${driverHistory.reason}`,
        addedAt: new Date(),
      });
      await complaint.save();
    }
    
    // Get updated credibility
    const userCredibility = await Complaint.getUserCredibility(userId);
    
    console.log(`📋 New complaint filed: ${complaint._id} | Category: ${category} | Credibility Score: ${complaint.credibilityScore} | Auto-escalated: ${wasAutoEscalated}`);
    
    let responseMessage = 'Your complaint has been submitted successfully. Our team will review it within 24-48 hours.';
    if (wasAutoEscalated) {
      responseMessage = 'Your complaint has been submitted and has been automatically escalated due to its severity. An admin will review it as soon as possible.';
    }
    
    res.status(201).json({
      success: true,
      message: responseMessage,
      complaint: {
        _id: complaint._id,
        status: complaint.status,
        credibilityScore: complaint.credibilityScore,
        autoEscalated: wasAutoEscalated,
        createdAt: complaint.createdAt,
      },
      driverHistory: driverHistory ? {
        totalComplaints: driverHistory.complaintCount,
        criticalComplaints: driverHistory.criticalCount,
        recentComplaints: driverHistory.recentComplaintCount,
        automatedAction: driverHistory.action,
      } : null,
      userCredibility,
    });
  } catch (error) {
    console.error('Error filing complaint:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to file complaint',
      error: error.message,
    });
  }
};

/**
 * Get user's complaints
 * GET /api/complaints/my-complaints
 */
export const getMyComplaints = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { complainant: userId };
    if (status) {
      query.status = status;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const complaints = await Complaint.find(query)
      .populate('driver', 'firstname lastname username image')
      .populate('relatedBooking', 'pickup destination createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Complaint.countDocuments(query);
    
    res.status(200).json({
      success: true,
      complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
      error: error.message,
    });
  }
};

/**
 * Get complaint details
 * GET /api/complaints/:id
 */
export const getComplaintDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const complaint = await Complaint.findById(req.params.id)
      .populate('complainant', 'firstname lastname username image')
      .populate('driver', 'firstname lastname username image phone')
      .populate('relatedBooking')
      .populate('assignedAdmin', 'firstname lastname')
      .populate('resolution.resolvedBy', 'firstname lastname');
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }
    
    // Only complainant or admin can view details
    const isComplainant = complaint.complainant._id.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isComplainant && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this complaint',
      });
    }
    
    res.status(200).json({
      success: true,
      complaint,
    });
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint details',
      error: error.message,
    });
  }
};

/**
 * Withdraw a complaint
 * PUT /api/complaints/:id/withdraw
 */
export const withdrawComplaint = async (req, res) => {
  try {
    const userId = req.user._id;
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }
    
    if (complaint.complainant.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to withdraw this complaint',
      });
    }
    
    // Can only withdraw pending complaints
    if (complaint.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only withdraw pending complaints',
      });
    }
    
    complaint.status = 'withdrawn';
    await complaint.save();
    
    res.status(200).json({
      success: true,
      message: 'Complaint withdrawn successfully',
    });
  } catch (error) {
    console.error('Error withdrawing complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw complaint',
      error: error.message,
    });
  }
};

/**
 * Get user's recent bookings (for complaint context)
 * GET /api/complaints/recent-bookings
 */
export const getRecentBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get completed bookings from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const bookings = await Booking.find({
      user: userId,
      status: { $in: ['completed', 'cancelled'] },
      createdAt: { $gte: sevenDaysAgo },
    })
      .populate('driver', 'firstname lastname username image')
      .select('pickup destination driver createdAt completedAt agreedFare status')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error('Error fetching recent bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent bookings',
      error: error.message,
    });
  }
};

// ==================== ADMIN FUNCTIONS ====================

/**
 * Admin: Get all complaints
 * GET /api/complaints/admin/all
 * 
 * Supports filtering by sentiment analysis urgency:
 * - urgency: 'critical', 'high', 'medium', 'low', 'normal'
 * - priorityOnly: true (filters complaints with mayRequireImmediateAttention flag)
 */
export const adminGetAllComplaints = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minCredibility,
      maxCredibility,
      urgency,
      priorityOnly,
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};
    
    if (status) query.status = status;
    if (category) query.category = category;
    
    if (minCredibility || maxCredibility) {
      query.credibilityScore = {};
      if (minCredibility) query.credibilityScore.$gte = parseInt(minCredibility);
      if (maxCredibility) query.credibilityScore.$lte = parseInt(maxCredibility);
    }
    
    // Filter by sentiment urgency
    if (urgency) {
      query['sentimentAnalysis.urgency'] = urgency;
    }
    
    // Filter by high priority (immediate attention required)
    if (priorityOnly === 'true') {
      query['sentimentAnalysis.flags.mayRequireImmediateAttention'] = true;
    }
    
    // Default sort: prioritize critical/high urgency complaints
    let sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    if (sortBy === 'priority') {
      // Custom sort: critical > high > medium > low > normal
      sort = {
        'sentimentAnalysis.severityScore': -1,
        createdAt: -1,
      };
    }
    
    const complaints = await Complaint.find(query)
      .populate('complainant', 'firstname lastname username image')
      .populate('driver', 'firstname lastname username image')
      .populate('assignedAdmin', 'firstname lastname')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Complaint.countDocuments(query);
    
    // Get stats including sentiment analysis priority stats
    const stats = {
      total: await Complaint.countDocuments(),
      pending: await Complaint.countDocuments({ status: 'pending' }),
      underReview: await Complaint.countDocuments({ status: 'under_review' }),
      investigating: await Complaint.countDocuments({ status: 'investigating' }),
      resolved: await Complaint.countDocuments({ status: 'resolved' }),
      dismissed: await Complaint.countDocuments({ status: 'dismissed' }),
      lowCredibility: await Complaint.countDocuments({ credibilityScore: { $lt: 30 } }),
      // Sentiment Analysis Priority Stats
      priority: {
        critical: await Complaint.countDocuments({ 
          'sentimentAnalysis.urgency': 'critical',
          status: { $nin: ['resolved', 'dismissed', 'withdrawn'] }
        }),
        high: await Complaint.countDocuments({ 
          'sentimentAnalysis.urgency': 'high',
          status: { $nin: ['resolved', 'dismissed', 'withdrawn'] }
        }),
        medium: await Complaint.countDocuments({ 
          'sentimentAnalysis.urgency': 'medium',
          status: { $nin: ['resolved', 'dismissed', 'withdrawn'] }
        }),
        low: await Complaint.countDocuments({ 
          'sentimentAnalysis.urgency': 'low',
          status: { $nin: ['resolved', 'dismissed', 'withdrawn'] }
        }),
        needsImmediateAttention: await Complaint.countDocuments({ 
          'sentimentAnalysis.flags.mayRequireImmediateAttention': true,
          status: { $nin: ['resolved', 'dismissed', 'withdrawn'] }
        }),
      },
    };
    
    res.status(200).json({
      success: true,
      complaints,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
      error: error.message,
    });
  }
};

/**
 * Admin: Update complaint status
 * PUT /api/complaints/admin/:id/status
 */
export const adminUpdateComplaintStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const adminId = req.user._id;
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }
    
    const previousStatus = complaint.status;
    complaint.status = status;
    
    // Assign admin if not already assigned
    if (!complaint.assignedAdmin) {
      complaint.assignedAdmin = adminId;
    }
    
    // Add note if provided
    if (note) {
      complaint.adminNotes.push({
        note: `Status changed from ${previousStatus} to ${status}. ${note}`,
        addedBy: adminId,
      });
    }
    
    await complaint.save();
    
    res.status(200).json({
      success: true,
      message: 'Complaint status updated successfully',
      complaint,
    });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update complaint status',
      error: error.message,
    });
  }
};

/**
 * Admin: Resolve complaint
 * PUT /api/complaints/admin/:id/resolve
 */
export const adminResolveComplaint = async (req, res) => {
  try {
    const { action, details, isFalseComplaint, createViolation = true } = req.body;
    const adminId = req.user._id;
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }
    
    complaint.status = isFalseComplaint ? 'dismissed' : 'resolved';
    complaint.resolution = {
      action,
      details,
      resolvedAt: new Date(),
      resolvedBy: adminId,
    };
    
    // Handle false complaint
    if (isFalseComplaint) {
      complaint.isFalseComplaint = true;
      
      // Check user's false complaint history
      const falseComplaints = await Complaint.countDocuments({
        complainant: complaint.complainant,
        isFalseComplaint: true,
      });
      
      // Apply penalties based on false complaint count
      const user = await User.findById(complaint.complainant);
      if (user) {
        if (falseComplaints >= 3) {
          // Ban user from filing complaints for 30 days
          user.complaintBanUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          complaint.falseComplaintPenalty = {
            applied: true,
            type: 'ban',
            appliedAt: new Date(),
          };
        } else if (falseComplaints >= 2) {
          // Restrict for 7 days
          user.complaintBanUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          complaint.falseComplaintPenalty = {
            applied: true,
            type: 'restriction',
            appliedAt: new Date(),
          };
        } else {
          // First offense - warning
          complaint.falseComplaintPenalty = {
            applied: true,
            type: 'warning',
            appliedAt: new Date(),
          };
        }
        await user.save();
      }
    }
    
    complaint.adminNotes.push({
      note: `Complaint ${isFalseComplaint ? 'dismissed as false/defamatory' : 'resolved'}. Action: ${action}. ${details}`,
      addedBy: adminId,
    });
    
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = adminId;
    complaint.actionTaken = action;
    
    await complaint.save();
    
    // Create violation record if complaint is valid and has action taken
    let violationCreated = null;
    if (!isFalseComplaint && createViolation && complaint.driver) {
      try {
        violationCreated = await createViolationFromComplaint(complaint, adminId);
        complaint.linkedViolation = violationCreated._id;
        await complaint.save();
      } catch (violationError) {
        console.error('Error creating violation from complaint:', violationError);
        // Continue - complaint is still resolved even if violation creation fails
      }
    }
    
    // Log admin activity
    const AdminActivityLog = (await import('../models/adminActivityLogModel.js')).default;
    const admin = await User.findById(adminId);
    const driver = await User.findById(complaint.driver);
    
    await AdminActivityLog.logActivity({
      adminId: adminId,
      adminEmail: admin?.email || 'unknown',
      adminName: `${admin?.firstname || ''} ${admin?.lastname || ''}`.trim() || 'Admin',
      action: isFalseComplaint ? 'COMPLAINT_MARKED_FALSE' : 'COMPLAINT_RESOLVED',
      description: `${isFalseComplaint ? 'Dismissed' : 'Resolved'} complaint against ${driver?.firstname || 'Driver'} ${driver?.lastname || ''}. Action: ${action}. ${details || ''}${violationCreated ? ` Violation #${violationCreated._id} created.` : ''}`.trim(),
      targetUserId: complaint.driver,
      targetUserEmail: driver?.email,
      targetUserName: `${driver?.firstname || ''} ${driver?.lastname || ''}`.trim(),
      previousValue: { status: 'investigating' },
      newValue: { status: complaint.status, action, isFalseComplaint, violationId: violationCreated?._id },
      metadata: {
        complaintId: complaint._id,
        category: complaint.category,
        violationId: violationCreated?._id,
      },
      ipAddress: req.ip || req.connection?.remoteAddress,
    });
    
    res.status(200).json({
      success: true,
      message: `Complaint ${isFalseComplaint ? 'dismissed' : 'resolved'} successfully${violationCreated ? '. Violation recorded with penalty: ' + violationCreated.penalty.label : ''}`,
      complaint,
      violation: violationCreated,
    });
  } catch (error) {
    console.error('Error resolving complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve complaint',
      error: error.message,
    });
  }
};

/**
 * Admin: Add note to complaint
 * POST /api/complaints/admin/:id/note
 */
export const adminAddNote = async (req, res) => {
  try {
    const { note } = req.body;
    const adminId = req.user._id;
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }
    
    complaint.adminNotes.push({
      note,
      addedBy: adminId,
    });
    
    await complaint.save();
    
    res.status(200).json({
      success: true,
      message: 'Note added successfully',
    });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error: error.message,
    });
  }
};

/**
 * Admin: Get driver complaint history
 * GET /api/complaints/admin/driver/:driverId
 */
export const adminGetDriverComplaints = async (req, res) => {
  try {
    const { driverId } = req.params;
    
    const driver = await User.findOne({ _id: driverId, role: 'driver' })
      .select('firstname lastname username image rating');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }
    
    const complaints = await Complaint.find({ driver: driverId })
      .populate('complainant', 'firstname lastname username')
      .sort({ createdAt: -1 });
    
    // Calculate stats
    const stats = {
      total: complaints.length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
      dismissed: complaints.filter(c => c.status === 'dismissed').length,
      pending: complaints.filter(c => ['pending', 'under_review', 'investigating'].includes(c.status)).length,
      byCategory: {},
    };
    
    complaints.forEach(c => {
      stats.byCategory[c.category] = (stats.byCategory[c.category] || 0) + 1;
    });
    
    res.status(200).json({
      success: true,
      driver,
      complaints,
      stats,
    });
  } catch (error) {
    console.error('Error fetching driver complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver complaints',
      error: error.message,
    });
  }
};

/**
 * Get complaint categories
 * GET /api/complaints/categories
 */
export const getComplaintCategories = async (req, res) => {
  const categories = [
    { value: 'rude_behavior', label: 'Rude or Disrespectful Behavior', description: 'Driver was verbally abusive or showed disrespect' },
    { value: 'overcharging', label: 'Overcharging', description: 'Driver charged more than the agreed fare' },
    { value: 'unsafe_driving', label: 'Unsafe Driving', description: 'Driver drove recklessly or dangerously' },
    { value: 'route_deviation', label: 'Route Deviation', description: 'Driver took an unnecessarily long route' },
    { value: 'vehicle_condition', label: 'Poor Vehicle Condition', description: 'Vehicle was dirty or in poor condition' },
    { value: 'refusal_of_service', label: 'Refusal of Service', description: 'Driver refused to provide service without valid reason' },
    { value: 'harassment', label: 'Harassment', description: 'Driver engaged in verbal or physical harassment' },
    { value: 'discrimination', label: 'Discrimination', description: 'Driver discriminated based on race, gender, etc.' },
    { value: 'intoxicated_driving', label: 'Intoxicated Driving', description: 'Driver appeared to be under the influence' },
    { value: 'other', label: 'Other', description: 'Other issues not listed above' },
  ];
  
  res.status(200).json({
    success: true,
    categories,
  });
};

// ==================== OPERATOR FUNCTIONS ====================

/**
 * Operator: Get complaints against their drivers
 * GET /api/complaints/operator/my-drivers
 */
export const operatorGetDriverComplaints = async (req, res) => {
  try {
    const operatorId = req.user._id;
    const { page = 1, limit = 20, status, driverId } = req.query;
    
    // Get all tricycles owned by this operator
    const tricycles = await Tricycle.find({ operator: operatorId }).select('driver');
    const driverIds = tricycles.map(t => t.driver).filter(Boolean);
    
    if (driverIds.length === 0) {
      return res.status(200).json({
        success: true,
        complaints: [],
        stats: { total: 0, pending: 0, resolved: 0, dismissed: 0 },
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      });
    }
    
    const query = { driver: { $in: driverIds } };
    if (status) query.status = status;
    if (driverId && driverIds.includes(driverId)) query.driver = driverId;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const complaints = await Complaint.find(query)
      .populate('complainant', 'firstname lastname image')
      .populate('driver', 'firstname lastname username image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Complaint.countDocuments(query);
    
    // Stats for operator's drivers
    const stats = {
      total: await Complaint.countDocuments({ driver: { $in: driverIds } }),
      pending: await Complaint.countDocuments({ driver: { $in: driverIds }, status: { $in: ['pending', 'under_review', 'investigating'] } }),
      resolved: await Complaint.countDocuments({ driver: { $in: driverIds }, status: 'resolved' }),
      dismissed: await Complaint.countDocuments({ driver: { $in: driverIds }, status: 'dismissed' }),
    };
    
    res.status(200).json({
      success: true,
      complaints,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching operator driver complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
      error: error.message,
    });
  }
};

/**
 * Operator: Get complaint details for their driver
 * GET /api/complaints/operator/:id
 */
export const operatorGetComplaintDetails = async (req, res) => {
  try {
    const operatorId = req.user._id;
    
    // Verify this complaint is for one of the operator's drivers
    const tricycles = await Tricycle.find({ operator: operatorId }).select('driver');
    const driverIds = tricycles.map(t => t.driver?.toString()).filter(Boolean);
    
    const complaint = await Complaint.findById(req.params.id)
      .populate('complainant', 'firstname lastname username image email phone')
      .populate('driver', 'firstname lastname username image phone')
      .populate('relatedBooking', 'pickup destination fare createdAt');
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }
    
    if (!driverIds.includes(complaint.driver._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'You can only view complaints for your own drivers',
      });
    }
    
    // Get driver's complaint history
    const driverHistory = await checkDriverComplaintHistory(complaint.driver._id);
    
    res.status(200).json({
      success: true,
      complaint,
      driverHistory,
    });
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint details',
      error: error.message,
    });
  }
};

/**
 * Operator: Add response/statement to complaint
 * POST /api/complaints/operator/:id/response
 */
export const operatorAddResponse = async (req, res) => {
  try {
    const operatorId = req.user._id;
    const { response } = req.body;
    
    if (!response || response.length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a detailed response (at least 20 characters)',
      });
    }
    
    // Verify this complaint is for one of the operator's drivers
    const tricycles = await Tricycle.find({ operator: operatorId }).select('driver');
    const driverIds = tricycles.map(t => t.driver?.toString()).filter(Boolean);
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
      });
    }
    
    if (!driverIds.includes(complaint.driver.toString())) {
      return res.status(403).json({
        success: false,
        message: 'You can only respond to complaints for your own drivers',
      });
    }
    
    // Add operator response as admin note
    complaint.adminNotes.push({
      note: `📝 OPERATOR RESPONSE: ${response}`,
      addedBy: operatorId,
      addedAt: new Date(),
    });
    
    await complaint.save();
    
    // Notify admins about operator response
    try {
      const admins = await User.find({
        role: 'admin',
        FCMToken: { $exists: true, $ne: null },
      }).select('FCMToken');
      
      if (admins.length > 0 && messaging) {
        const tokens = admins.map(a => a.FCMToken).filter(Boolean);
        await messaging.sendEachForMulticast({
          notification: {
            title: '📝 Operator Response on Complaint',
            body: `Operator responded to complaint #${complaint._id.toString().slice(-6)}`,
          },
          data: {
            type: 'operator_response',
            complaintId: complaint._id.toString(),
          },
          tokens,
        });
      }
    } catch (notifyError) {
      console.error('Error notifying admins:', notifyError);
    }
    
    res.status(200).json({
      success: true,
      message: 'Your response has been added to the complaint record',
    });
  } catch (error) {
    console.error('Error adding operator response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add response',
      error: error.message,
    });
  }
};

/**
 * Get driver complaint summary (for operators/admins)
 * GET /api/complaints/driver-summary/:driverId
 */
export const getDriverComplaintSummary = async (req, res) => {
  try {
    const { driverId } = req.params;
    
    // If operator, verify they own this driver
    if (req.user.role === 'operator') {
      const tricycles = await Tricycle.find({ operator: req.user._id }).select('driver');
      const driverIds = tricycles.map(t => t.driver?.toString()).filter(Boolean);
      
      if (!driverIds.includes(driverId)) {
        return res.status(403).json({
          success: false,
          message: 'You can only view summaries for your own drivers',
        });
      }
    }
    
    const history = await checkDriverComplaintHistory(driverId);
    
    // Get category breakdown
    const categoryBreakdown = await Complaint.aggregate([
      { $match: { driver: new mongoose.Types.ObjectId(driverId), status: { $nin: ['dismissed', 'withdrawn'] } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    
    // Get recent complaints
    const recentComplaints = await Complaint.find({ driver: driverId })
      .select('category status createdAt credibilityScore')
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.status(200).json({
      success: true,
      summary: {
        ...history,
        categoryBreakdown,
        recentComplaints,
        riskLevel: history?.action === 'termination_review' ? 'critical' :
                   history?.action === 'suspension_recommended' ? 'high' :
                   history?.action === 'warning_issued' ? 'medium' : 'low',
      },
    });
  } catch (error) {
    console.error('Error fetching driver summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver summary',
      error: error.message,
    });
  }
};
/**
 * Detect body number from uploaded image using OCR
 * POST /api/complaints/detect-body-number
 */
export const detectBodyNumberFromImage = async (req, res) => {
  let tempFilePath = null;
  
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image of the tricycle body number',
      });
    }
    
    // Save buffer to temp file for OCR processing
    const tempDir = path.join(os.tmpdir(), 'tmod_ocr');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    tempFilePath = path.join(tempDir, `body_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`);
    fs.writeFileSync(tempFilePath, req.file.buffer);
    
    // Run body number detection
    const result = await detectBodyNumber(tempFilePath);
    
    if (!result.success) {
      return res.status(200).json({
        success: false,
        message: result.error || 'Could not detect body number in image',
        rawText: result.rawText || '',
        suggestion: 'Please ensure the body number is clearly visible and try again, or enter it manually.',
      });
    }
    
    // Check if detected body number exists in database
    let tricycleMatch = null;
    if (result.bodyNumber) {
      tricycleMatch = await Tricycle.findOne({ bodyNumber: result.bodyNumber })
        .populate('driver', 'firstname lastname image')
        .populate('operator', 'firstname lastname')
        .select('plateNumber bodyNumber model status driver operator');
    }
    
    res.status(200).json({
      success: true,
      bodyNumber: result.bodyNumber,
      confidence: result.confidence,
      original: result.original,
      candidates: result.candidates,
      tricycleMatch: tricycleMatch ? {
        _id: tricycleMatch._id,
        plateNumber: tricycleMatch.plateNumber,
        bodyNumber: tricycleMatch.bodyNumber,
        model: tricycleMatch.model,
        status: tricycleMatch.status,
        driver: tricycleMatch.driver ? {
          _id: tricycleMatch.driver._id,
          name: `${tricycleMatch.driver.firstname} ${tricycleMatch.driver.lastname}`,
          profilePicture: tricycleMatch.driver.image?.url,
        } : null,
        operator: tricycleMatch.operator ? {
          _id: tricycleMatch.operator._id,
          name: `${tricycleMatch.operator.firstname} ${tricycleMatch.operator.lastname}`,
        } : null,
      } : null,
      message: tricycleMatch 
        ? `Body number ${result.bodyNumber} found! Tricycle is registered.`
        : `Body number ${result.bodyNumber} detected but not found in our records.`,
    });
    
  } catch (error) {
    console.error('Error detecting body number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process image',
      error: error.message,
    });
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.error('Failed to delete temp file:', e);
      }
    }
  }
};

/**
 * Lookup tricycle by body number
 * GET /api/complaints/lookup-body-number/:bodyNumber
 */
export const lookupByBodyNumber = async (req, res) => {
  try {
    const { bodyNumber } = req.params;
    
    if (!bodyNumber) {
      return res.status(400).json({
        success: false,
        message: 'Body number is required',
      });
    }
    
    // Format and search
    const formattedNumber = formatBodyNumber(bodyNumber);
    
    const tricycle = await Tricycle.findOne({ 
      $or: [
        { bodyNumber: formattedNumber },
        { bodyNumber: bodyNumber.trim() },
        { bodyNumber: bodyNumber.trim().padStart(4, '0') },
      ]
    })
      .populate('driver', 'firstname lastname image phone')
      .populate('operator', 'firstname lastname phone')
      .select('plateNumber bodyNumber model status driver operator');
    
    if (!tricycle) {
      return res.status(200).json({
        success: false,
        message: `No tricycle found with body number ${bodyNumber}`,
      });
    }
    
    res.status(200).json({
      success: true,
      tricycle: {
        _id: tricycle._id,
        plateNumber: tricycle.plateNumber,
        bodyNumber: tricycle.bodyNumber,
        model: tricycle.model,
        status: tricycle.status,
        driver: tricycle.driver ? {
          _id: tricycle.driver._id,
          name: `${tricycle.driver.firstname} ${tricycle.driver.lastname}`,
          profilePicture: tricycle.driver.image?.url,
        } : null,
        operator: tricycle.operator ? {
          _id: tricycle.operator._id,
          name: `${tricycle.operator.firstname} ${tricycle.operator.lastname}`,
        } : null,
      },
    });
    
  } catch (error) {
    console.error('Error looking up body number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to lookup body number',
      error: error.message,
    });
  }
};
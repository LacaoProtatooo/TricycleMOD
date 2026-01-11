import Complaint from '../models/complaintModel.js';
import User from '../models/userModel.js';
import Booking from '../models/bookingModel.js';
import cloudinary from '../utils/cloudinaryConfig.js';
import { messaging } from '../utils/firebase.js';

/**
 * Complaint Controller
 * 
 * Handles complaint filing with anti-abuse measures:
 * - Rate limiting
 * - Required evidence verification
 * - Credibility scoring
 * - Admin management workflows
 * - Notification to admin and operators
 */

/**
 * Send push notification to admins and operators
 */
const notifyAdminsAndOperators = async (complaint, complainant, driver) => {
  try {
    // Get all admins and operators with FCM tokens
    const recipients = await User.find({
      role: { $in: ['admin', 'operator'] },
      FCMToken: { $exists: true, $ne: null },
    }).select('FCMToken role firstname');
    
    if (recipients.length === 0) {
      console.log('No admins/operators with FCM tokens to notify');
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
    
    const title = '🚨 New Driver Complaint Filed';
    const body = `${complainant.firstname} filed a complaint against ${driver.firstname} ${driver.lastname} for ${categoryLabels[complaint.category] || complaint.category}`;
    
    const tokens = recipients.map(r => r.FCMToken).filter(Boolean);
    
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
        },
        tokens,
      };
      
      const response = await messaging.sendEachForMulticast(message);
      console.log(`📱 Complaint notification sent: ${response.successCount}/${tokens.length} successful`);
    }
  } catch (error) {
    console.error('Error sending complaint notifications:', error);
    // Don't throw - notification failure shouldn't fail the complaint
  }
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
    });
    
    await complaint.save();
    
    // Send notifications to admins and operators
    await notifyAdminsAndOperators(complaint, req.user, driver);
    
    // Get updated credibility
    const userCredibility = await Complaint.getUserCredibility(userId);
    
    console.log(`📋 New complaint filed: ${complaint._id} | Category: ${category} | Credibility Score: ${complaint.credibilityScore}`);
    
    res.status(201).json({
      success: true,
      message: 'Your complaint has been submitted successfully. Our team will review it within 24-48 hours.',
      complaint: {
        _id: complaint._id,
        status: complaint.status,
        credibilityScore: complaint.credibilityScore,
        createdAt: complaint.createdAt,
      },
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
    
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    const complaints = await Complaint.find(query)
      .populate('complainant', 'firstname lastname username image')
      .populate('driver', 'firstname lastname username image')
      .populate('assignedAdmin', 'firstname lastname')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Complaint.countDocuments(query);
    
    // Get stats
    const stats = {
      total: await Complaint.countDocuments(),
      pending: await Complaint.countDocuments({ status: 'pending' }),
      underReview: await Complaint.countDocuments({ status: 'under_review' }),
      investigating: await Complaint.countDocuments({ status: 'investigating' }),
      resolved: await Complaint.countDocuments({ status: 'resolved' }),
      dismissed: await Complaint.countDocuments({ status: 'dismissed' }),
      lowCredibility: await Complaint.countDocuments({ credibilityScore: { $lt: 30 } }),
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
    const { action, details, isFalseComplaint } = req.body;
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
    
    await complaint.save();
    
    res.status(200).json({
      success: true,
      message: `Complaint ${isFalseComplaint ? 'dismissed' : 'resolved'} successfully`,
      complaint,
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

import mongoose from 'mongoose';

/**
 * Complaint Model
 * 
 * Handles guest complaints against drivers with built-in anti-abuse measures:
 * - Required evidence (photos/screenshots)
 * - Rate limiting (max complaints per user per day)
 * - Credibility scoring system
 * - Admin review workflow
 */

const evidenceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true,
  },
  public_id: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const complaintSchema = new mongoose.Schema({
  // Complainant information
  complainant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  complainantContact: {
    phone: { type: String },
    email: { type: String },
  },
  
  // Driver being complained about
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // Related booking (optional - for context)
  relatedBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: false,
  },
  
  // Complaint details
  category: {
    type: String,
    enum: [
      'rude_behavior',           // Rude or disrespectful behavior
      'overcharging',            // Charged more than agreed fare
      'unsafe_driving',          // Reckless or dangerous driving
      'route_deviation',         // Took longer route intentionally
      'vehicle_condition',       // Poor vehicle condition/cleanliness
      'refusal_of_service',      // Refused to provide service
      'harassment',              // Verbal/physical harassment
      'discrimination',          // Discriminatory behavior
      'intoxicated_driving',     // Driver appeared intoxicated
      'other',                   // Other issues
    ],
    required: true,
  },
  
  description: {
    type: String,
    required: [true, 'Please provide a detailed description of the incident'],
    minlength: [50, 'Description must be at least 50 characters to provide sufficient detail'],
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  
  // Required evidence - at least one piece of evidence required
  evidence: {
    type: [evidenceSchema],
    validate: {
      validator: function(v) {
        return v && v.length >= 1;
      },
      message: 'At least one piece of evidence (photo/video) is required to file a complaint',
    },
  },
  
  // Incident details
  incidentDate: {
    type: Date,
    required: [true, 'Please provide the date when the incident occurred'],
    validate: {
      validator: function(v) {
        // Incident must be within the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return v >= sevenDaysAgo && v <= new Date();
      },
      message: 'Incident date must be within the last 7 days',
    },
  },
  
  incidentLocation: {
    address: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  
  // Tricycle details (for identification)
  tricycleDetails: {
    plateNumber: { type: String },
    bodyNumber: { type: String },
    description: { type: String }, // Physical description if plate not visible
  },
  
  // Complaint status and workflow
  status: {
    type: String,
    enum: [
      'pending',           // Newly submitted, awaiting review
      'under_review',      // Being reviewed by admin
      'investigating',     // Under active investigation
      'resolved',          // Resolved with action taken
      'dismissed',         // Dismissed (no action, invalid complaint)
      'withdrawn',         // Withdrawn by complainant
    ],
    default: 'pending',
  },
  
  // Admin review information
  assignedAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  adminNotes: [{
    note: { type: String },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now },
  }],
  
  resolution: {
    action: {
      type: String,
      enum: [
        'warning_issued',        // Warning given to driver
        'suspension',            // Temporary suspension
        'termination',           // Permanent removal
        'mediation',             // Mediation between parties
        'no_action',             // No action taken
        'referred_to_authorities', // Referred to police/LTFRB
      ],
    },
    details: { type: String },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  
  // Anti-abuse measures
  credibilityScore: {
    type: Number,
    default: 50, // Start at neutral (0-100 scale)
    min: 0,
    max: 100,
  },
  
  // Flags for suspicious complaints
  flags: {
    isFromNewAccount: { type: Boolean, default: false },
    hasMultipleComplaintsToday: { type: Boolean, default: false },
    targetsSameDriver: { type: Boolean, default: false },
    hasVagueDescription: { type: Boolean, default: false },
    evidenceQualityLow: { type: Boolean, default: false },
  },
  
  // Track if complaint was found to be false/defamatory
  isFalseComplaint: {
    type: Boolean,
    default: false,
  },
  
  falseComplaintPenalty: {
    applied: { type: Boolean, default: false },
    type: { type: String, enum: ['warning', 'restriction', 'ban'] },
    appliedAt: { type: Date },
  },
  
  // IP address for tracking abuse patterns
  submittedFromIP: { type: String },
  
  // User agent for additional tracking
  userAgent: { type: String },
  
  // Sentiment Analysis Results (from Hugging Face)
  sentimentAnalysis: {
    sentiment: { 
      type: String, 
      enum: ['positive', 'negative', 'neutral'],
    },
    confidence: { type: Number, min: 0, max: 1 },
    scores: {
      POSITIVE: { type: Number },
      NEGATIVE: { type: Number },
    },
    severityScore: { type: Number, min: 0, max: 5 },
    urgency: { 
      type: String, 
      enum: ['low', 'medium', 'normal', 'high', 'critical'],
    },
    descriptionQuality: { type: Number, min: 0, max: 100 },
    flags: {
      highlyNegative: { type: Boolean, default: false },
      mayRequireImmediateAttention: { type: Boolean, default: false },
      emotionallyCharged: { type: Boolean, default: false },
    },
    // Detected Taglish indicator words
    taglishIndicators: {
      negativeWords: [{ type: String }],
      positiveWords: [{ type: String }],
      isTaglish: { type: Boolean, default: false },
    },
    analyzedAt: { type: Date },
  },
  
}, { timestamps: true });

// Indexes for efficient queries
complaintSchema.index({ complainant: 1, createdAt: -1 });
complaintSchema.index({ driver: 1, createdAt: -1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ 'incidentLocation.latitude': 1, 'incidentLocation.longitude': 1 });

// Pre-save middleware to set flags
complaintSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Check if user account is new (less than 7 days old)
    const User = mongoose.model('User');
    const user = await User.findById(this.complainant);
    if (user) {
      const accountAge = Date.now() - new Date(user.createdAt).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      this.flags.isFromNewAccount = accountAge < sevenDays;
    }
    
    // Check for multiple complaints today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const complaintsToday = await mongoose.model('Complaint').countDocuments({
      complainant: this.complainant,
      createdAt: { $gte: todayStart },
    });
    this.flags.hasMultipleComplaintsToday = complaintsToday >= 1;
    
    // Check if user has complained about same driver before
    const previousComplaints = await mongoose.model('Complaint').countDocuments({
      complainant: this.complainant,
      driver: this.driver,
    });
    this.flags.targetsSameDriver = previousComplaints >= 1;
    
    // Check description quality
    if (this.description.length < 100) {
      this.flags.hasVagueDescription = true;
    }
    
    // Calculate initial credibility score
    let score = 50;
    if (this.flags.isFromNewAccount) score -= 10;
    if (this.flags.hasMultipleComplaintsToday) score -= 15;
    if (this.flags.targetsSameDriver) score -= 10;
    if (this.flags.hasVagueDescription) score -= 10;
    if (this.evidence.length >= 2) score += 10;
    if (this.relatedBooking) score += 15; // Has booking reference
    if (this.description.length >= 200) score += 5;
    
    this.credibilityScore = Math.max(0, Math.min(100, score));
  }
  next();
});

// Static method to check if user can file a complaint
complaintSchema.statics.canUserFileComplaint = async function(userId) {
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  if (!user) {
    return { canFile: false, reason: 'User not found' };
  }
  
  // Check if user is banned from filing complaints
  if (user.complaintBanUntil && new Date() < user.complaintBanUntil) {
    return { 
      canFile: false, 
      reason: 'You are temporarily restricted from filing complaints due to previous false complaints',
      banEndsAt: user.complaintBanUntil,
    };
  }
  
  // Rate limiting: max 3 complaints per day
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const complaintsToday = await this.countDocuments({
    complainant: userId,
    createdAt: { $gte: todayStart },
  });
  
  if (complaintsToday >= 3) {
    return { 
      canFile: false, 
      reason: 'You have reached the maximum number of complaints (3) for today. Please try again tomorrow.',
    };
  }
  
  // Check pending complaints (max 5 pending at a time)
  const pendingComplaints = await this.countDocuments({
    complainant: userId,
    status: { $in: ['pending', 'under_review', 'investigating'] },
  });
  
  if (pendingComplaints >= 5) {
    return {
      canFile: false,
      reason: 'You have too many pending complaints. Please wait for your existing complaints to be reviewed.',
    };
  }
  
  return { canFile: true, complaintsToday, pendingComplaints };
};

// Static method to get user's complaint history credibility
complaintSchema.statics.getUserCredibility = async function(userId) {
  const complaints = await this.find({ complainant: userId });
  
  if (complaints.length === 0) {
    return { score: 50, totalComplaints: 0, validComplaints: 0, falseComplaints: 0 };
  }
  
  const validComplaints = complaints.filter(c => 
    c.status === 'resolved' && !c.isFalseComplaint
  ).length;
  
  const falseComplaints = complaints.filter(c => c.isFalseComplaint).length;
  
  // Calculate credibility based on history
  let baseScore = 50;
  baseScore += validComplaints * 5; // +5 for each valid complaint
  baseScore -= falseComplaints * 20; // -20 for each false complaint
  
  return {
    score: Math.max(0, Math.min(100, baseScore)),
    totalComplaints: complaints.length,
    validComplaints,
    falseComplaints,
  };
};

const Complaint = mongoose.model('Complaint', complaintSchema);

export default Complaint;

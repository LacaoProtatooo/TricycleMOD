import mongoose from 'mongoose';

/**
 * Violation Model
 * 
 * Tracks driver violations with progressive discipline system
 * based on WEBTTODA Rules and Regulations.
 * 
 * Categories:
 * I. Work and Drive Efficiency
 * II. Act of Dishonesty
 * III. Act Against Public Policy
 * IV. Serious Offenses
 * V. Repeated Violations
 */

// WEBTTODA Rules Reference
export const WEBTTODA_RULES = {
  // Category I: Work & Drive Efficiency
  1: {
    category: 'work_drive_efficiency',
    categoryName: 'Work & Drive Efficiency',
    rule: 'Act of insubordination',
    offense: 'Any act of insubordination',
    penalties: [
      { offense: 1, action: 'suspension', days: 3, label: 'Suspension 3 days' },
      { offense: 2, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 3, action: 'suspension', days: 30, label: 'Suspension 1 month or dismissal' },
      { offense: 4, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  2: {
    category: 'work_drive_efficiency',
    categoryName: 'Work & Drive Efficiency',
    rule: 'Illegal lining',
    offense: 'Illegal lining other than prescribed point',
    penalties: [
      { offense: 1, action: 'suspension', days: 3, label: 'Suspension 3 days' },
      { offense: 2, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 3, action: 'suspension', days: 30, label: 'Suspension 1 month or dismissal' },
      { offense: 4, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  3: {
    category: 'work_drive_efficiency',
    categoryName: 'Work & Drive Efficiency',
    rule: 'Illegal pick-up',
    offense: 'Illegal pick-up of passengers',
    penalties: [
      { offense: 1, action: 'suspension', days: 3, label: 'Suspension 3 days' },
      { offense: 2, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 3, action: 'suspension', days: 30, label: 'Suspension 1 month or dismissal' },
      { offense: 4, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  4: {
    category: 'work_drive_efficiency',
    categoryName: 'Work & Drive Efficiency',
    rule: 'Illegal loading/unloading',
    offense: 'Illegal loading and unloading of passengers',
    penalties: [
      { offense: 1, action: 'suspension', days: 3, label: 'Suspension 3 days' },
      { offense: 2, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 3, action: 'suspension', days: 30, label: 'Suspension 1 month or dismissal' },
      { offense: 4, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  5: {
    category: 'work_drive_efficiency',
    categoryName: 'Work & Drive Efficiency',
    rule: 'Neglect of duty',
    offense: 'Neglect of duty',
    penalties: [
      { offense: 1, action: 'suspension', days: 3, label: 'Suspension 3 days' },
      { offense: 2, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 3, action: 'suspension', days: 30, label: 'Suspension 1 month or dismissal' },
      { offense: 4, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  6: {
    category: 'work_drive_efficiency',
    categoryName: 'Work & Drive Efficiency',
    rule: 'AWOL',
    offense: 'AWOL - Absence without official leave',
    penalties: [
      { offense: 1, action: 'suspension', days: 3, label: 'Suspension 3 days' },
      { offense: 2, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 3, action: 'suspension', days: 30, label: 'Suspension 1 month' },
      { offense: 4, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  // Category II: Act of Dishonesty
  7: {
    category: 'act_of_dishonesty',
    categoryName: 'Act of Dishonesty',
    rule: 'Failure to pay dues',
    offense: 'Failure and/or refusing to pay the daily dues',
    penalties: [
      { offense: 1, action: 'suspension', days: 1, label: 'Suspension 1 day' },
      { offense: 2, action: 'suspension', days: 3, label: 'Suspension 3 days' },
      { offense: 3, action: 'suspension', days: 30, label: 'Suspension 1 month or dismissal' },
      { offense: 4, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  8: {
    category: 'act_of_dishonesty',
    categoryName: 'Act of Dishonesty',
    rule: 'False statement',
    offense: 'FALSE STATEMENT – Fraudulent entries to influence approval',
    penalties: [
      { offense: 1, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  // Category III: Act Against Public Policy
  9: {
    category: 'act_against_public_policy',
    categoryName: 'Act Against Public Policy',
    rule: 'DUI/Drinking within premises',
    offense: 'Driving under the influence of liquor, drug and/or participating in drinking spree within WEBTTODA premises',
    penalties: [
      { offense: 1, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 2, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  10: {
    category: 'act_against_public_policy',
    categoryName: 'Act Against Public Policy',
    rule: 'Smoking in prohibited areas',
    offense: 'Smoking in prohibited area within terminal premises',
    penalties: [
      { offense: 1, action: 'suspension', days: 3, label: 'Suspension 3 days' },
      { offense: 2, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 3, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  11: {
    category: 'act_against_public_policy',
    categoryName: 'Act Against Public Policy',
    rule: 'Theft of association/member property',
    offense: 'Theft of association and or members property',
    penalties: [
      { offense: 1, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  12: {
    category: 'act_against_public_policy',
    categoryName: 'Act Against Public Policy',
    rule: 'Fighting within premises',
    offense: 'Quarreling or fighting within the association premises',
    penalties: [
      { offense: 1, action: 'suspension', days: 14, label: 'Suspension 2 weeks' },
      { offense: 2, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  13: {
    category: 'act_against_public_policy',
    categoryName: 'Act Against Public Policy',
    rule: 'Challenging members to fight',
    offense: 'Challenging any member to fight',
    penalties: [
      { offense: 1, action: 'suspension', days: 14, label: 'Suspension 2 weeks' },
      { offense: 2, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  14: {
    category: 'act_against_public_policy',
    categoryName: 'Act Against Public Policy',
    rule: 'Challenging officers/trustees',
    offense: 'Challenging Officers and Trustees',
    penalties: [
      { offense: 1, action: 'suspension', days: 14, label: 'Suspension 2 weeks or dismissal' },
      { offense: 2, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  15: {
    category: 'act_against_public_policy',
    categoryName: 'Act Against Public Policy',
    rule: 'Discourtesy to passengers',
    offense: 'Discourteous Acts Committed against passengers within the association playing route area',
    penalties: [
      { offense: 1, action: 'suspension', days: 3, label: 'Suspension 3 days' },
      { offense: 2, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 3, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  16: {
    category: 'act_against_public_policy',
    categoryName: 'Act Against Public Policy',
    rule: 'Reckless driving',
    offense: 'Reckless driving within the WEBTTODA playing routes',
    penalties: [
      { offense: 1, action: 'suspension', days: 7, label: 'Suspension 1 week or dismissal' },
      { offense: 2, action: 'suspension', days: 7, label: 'Suspension 1 week' },
    ],
  },
  17: {
    category: 'act_against_public_policy',
    categoryName: 'Act Against Public Policy',
    rule: 'Causing ill-will/dissension',
    offense: 'Cause ill-will and dissension or create cliques and/or intrigues among officers, trustees and members',
    penalties: [
      { offense: 1, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 2, action: 'suspension', days: 30, label: 'Suspension 1 month or dismissal' },
      { offense: 3, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  18: {
    category: 'act_against_public_policy',
    categoryName: 'Act Against Public Policy',
    rule: 'Coercing/intimidating members',
    offense: 'Treating coercing and intimidating below members',
    penalties: [
      { offense: 1, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 2, action: 'suspension', days: 30, label: 'Suspension 1 month' },
      { offense: 3, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  // Category IV: Serious Offenses
  19: {
    category: 'serious_offenses',
    categoryName: 'Serious Offenses',
    rule: 'Conviction of crime',
    offense: 'Conviction of crime involving moral turpitude',
    penalties: [
      { offense: 1, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  20: {
    category: 'serious_offenses',
    categoryName: 'Serious Offenses',
    rule: 'Illegal possession of firearms',
    offense: 'Illegal possession of firearm',
    penalties: [
      { offense: 1, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  21: {
    category: 'serious_offenses',
    categoryName: 'Serious Offenses',
    rule: 'Gross misconduct',
    offense: 'Gross misconduct',
    penalties: [
      { offense: 1, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  22: {
    category: 'serious_offenses',
    categoryName: 'Serious Offenses',
    rule: 'Damaging association property',
    offense: 'Misusing, destroying, defacing and/or damaging association property',
    penalties: [
      { offense: 1, action: 'suspension', days: 7, label: 'Suspension 1 week or Dismissal' },
    ],
  },
  23: {
    category: 'serious_offenses',
    categoryName: 'Serious Offenses',
    rule: 'Disrespect to executives',
    offense: 'Acts of disrespect or discourtesy to the association executive',
    penalties: [
      { offense: 1, action: 'suspension', days: 30, label: 'Suspension 1 month' },
      { offense: 2, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  24: {
    category: 'serious_offenses',
    categoryName: 'Serious Offenses',
    rule: 'Insulting conduct to officers',
    offense: 'Insulting and/or unbecoming conduct and/or language to the association officers and trustees',
    penalties: [
      { offense: 1, action: 'suspension', days: 14, label: 'Suspension 2 weeks' },
      { offense: 2, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  25: {
    category: 'serious_offenses',
    categoryName: 'Serious Offenses',
    rule: 'Disobedience to Marshall',
    offense: 'Disobedience to lawful orders of Marshall',
    penalties: [
      { offense: 1, action: 'suspension', days: 14, label: 'Suspension 2 weeks or dismissal' },
      { offense: 2, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  26: {
    category: 'serious_offenses',
    categoryName: 'Serious Offenses',
    rule: 'Failure to attend meeting',
    offense: 'Failure to attend the general meeting during the designated time and place without valid reason',
    penalties: [
      { offense: 1, action: 'suspension', days: 1, label: 'Suspension 1 day' },
      { offense: 2, action: 'suspension', days: 3, label: 'Suspension 3 days' },
      { offense: 3, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  27: {
    category: 'serious_offenses',
    categoryName: 'Serious Offenses',
    rule: 'Failure to observe cleanliness',
    offense: 'Failure to observe personal cleanliness, uncouth clothings',
    penalties: [
      { offense: 1, action: 'warning', days: 0, label: 'Warning' },
      { offense: 2, action: 'suspension', days: 3, label: 'Suspension 3 days' },
      { offense: 3, action: 'suspension', days: 7, label: 'Suspension 1 week' },
      { offense: 4, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
  // Category V: Repeated Violations
  28: {
    category: 'repeated_violations',
    categoryName: 'Repeated Violations',
    rule: 'Three warnings within 1 year',
    offense: 'Three warnings within a period of one (1) year last violation',
    penalties: [
      { offense: 1, action: 'suspension', days: 7, label: 'Suspension 1 week' },
    ],
  },
  29: {
    category: 'repeated_violations',
    categoryName: 'Repeated Violations',
    rule: 'Three suspensions within 1 year',
    offense: 'Three suspensions within a period of one (1) year last violation',
    penalties: [
      { offense: 1, action: 'dismissal', days: 0, label: 'Dismissal' },
    ],
  },
};

// Complaint category to WEBTTODA rule mapping
export const COMPLAINT_TO_RULE_MAPPING = {
  rude_behavior: 15,          // Discourtesy to passengers
  overcharging: 15,           // Discourtesy to passengers
  unsafe_driving: 16,         // Reckless driving
  route_deviation: 2,         // Illegal lining
  vehicle_condition: 27,      // Failure to observe cleanliness
  refusal_of_service: 5,      // Neglect of duty
  harassment: 21,             // Gross misconduct
  discrimination: 21,         // Gross misconduct
  intoxicated_driving: 9,     // DUI/Drinking within premises
  other: 5,                   // Neglect of duty
};

const violationSchema = new mongoose.Schema({
  // Driver who committed the violation
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  // WEBTTODA Rule reference
  ruleNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 29,
  },
  
  // Rule details (denormalized for quick access)
  ruleDetails: {
    category: { type: String },
    categoryName: { type: String },
    rule: { type: String },
    offense: { type: String },
  },
  
  // Offense number (1st, 2nd, 3rd, etc.)
  offenseNumber: {
    type: Number,
    required: true,
    min: 1,
  },
  
  // Source of the violation
  source: {
    type: String,
    enum: ['complaint', 'admin_report', 'system_detected', 'operator_report'],
    required: true,
  },
  
  // Related complaint (if applicable)
  relatedComplaint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
  },
  
  // Description/Notes about the violation
  description: {
    type: String,
    maxlength: 1000,
  },
  
  // Evidence
  evidence: [{
    type: { type: String, enum: ['image', 'video', 'document'] },
    url: { type: String },
    public_id: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  }],
  
  // Penalty applied
  penalty: {
    action: {
      type: String,
      enum: ['warning', 'suspension', 'dismissal'],
      required: true,
    },
    days: { type: Number, default: 0 },
    label: { type: String },
    appliedAt: { type: Date, default: Date.now },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'appealed', 'overturned', 'served', 'expired'],
    default: 'pending',
  },
  
  // Appeal information
  appeal: {
    isAppealed: { type: Boolean, default: false },
    appealReason: { type: String },
    appealedAt: { type: Date },
    appealDecision: { type: String, enum: ['pending', 'upheld', 'reduced', 'overturned'] },
    appealDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    appealDecisionAt: { type: Date },
    appealNotes: { type: String },
  },
  
  // Operator notification
  operatorNotified: {
    type: Boolean,
    default: false,
  },
  operatorNotifiedAt: {
    type: Date,
  },
  
  // Driver acknowledgement
  driverAcknowledged: {
    type: Boolean,
    default: false,
  },
  driverAcknowledgedAt: {
    type: Date,
  },
  
  // Incident date (when the violation occurred)
  incidentDate: {
    type: Date,
    required: true,
  },
  
  // Created by (admin or system)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  // Notes from admin
  adminNotes: [{
    note: { type: String },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now },
  }],
  
}, { timestamps: true });

// Indexes for efficient queries
violationSchema.index({ driver: 1, createdAt: -1 });
violationSchema.index({ ruleNumber: 1 });
violationSchema.index({ 'penalty.action': 1 });
violationSchema.index({ status: 1 });
violationSchema.index({ incidentDate: -1 });
violationSchema.index({ driver: 1, ruleNumber: 1 }); // For counting same-rule offenses

// Static method to get offense count for a driver and rule
violationSchema.statics.getOffenseCount = async function(driverId, ruleNumber, withinMonths = 12) {
  const dateThreshold = new Date();
  dateThreshold.setMonth(dateThreshold.getMonth() - withinMonths);
  
  const count = await this.countDocuments({
    driver: driverId,
    ruleNumber: ruleNumber,
    status: { $nin: ['overturned'] },
    incidentDate: { $gte: dateThreshold },
  });
  
  return count;
};

// Static method to get total violations for a driver
violationSchema.statics.getDriverViolationStats = async function(driverId, withinMonths = 12) {
  const dateThreshold = new Date();
  dateThreshold.setMonth(dateThreshold.getMonth() - withinMonths);
  
  const stats = await this.aggregate([
    {
      $match: {
        driver: new mongoose.Types.ObjectId(driverId),
        status: { $nin: ['overturned'] },
        incidentDate: { $gte: dateThreshold },
      },
    },
    {
      $group: {
        _id: null,
        totalViolations: { $sum: 1 },
        warnings: { $sum: { $cond: [{ $eq: ['$penalty.action', 'warning'] }, 1, 0] } },
        suspensions: { $sum: { $cond: [{ $eq: ['$penalty.action', 'suspension'] }, 1, 0] } },
        dismissals: { $sum: { $cond: [{ $eq: ['$penalty.action', 'dismissal'] }, 1, 0] } },
        totalSuspensionDays: { $sum: '$penalty.days' },
        byCategory: { $push: '$ruleDetails.category' },
      },
    },
  ]);
  
  return stats[0] || {
    totalViolations: 0,
    warnings: 0,
    suspensions: 0,
    dismissals: 0,
    totalSuspensionDays: 0,
  };
};

// Static method to check if auto-escalation is needed (3 warnings or 3 suspensions)
violationSchema.statics.checkAutoEscalation = async function(driverId) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  const stats = await this.aggregate([
    {
      $match: {
        driver: new mongoose.Types.ObjectId(driverId),
        status: { $nin: ['overturned'] },
        incidentDate: { $gte: oneYearAgo },
      },
    },
    {
      $group: {
        _id: '$penalty.action',
        count: { $sum: 1 },
      },
    },
  ]);
  
  const countsMap = {};
  stats.forEach(s => { countsMap[s._id] = s.count; });
  
  const warnings = countsMap.warning || 0;
  const suspensions = countsMap.suspension || 0;
  
  // Rule 28: Three warnings within 1 year = Suspension 1 week
  if (warnings >= 3) {
    return { escalate: true, rule: 28, reason: 'Three warnings within 1 year' };
  }
  
  // Rule 29: Three suspensions within 1 year = Dismissal
  if (suspensions >= 3) {
    return { escalate: true, rule: 29, reason: 'Three suspensions within 1 year' };
  }
  
  return { escalate: false };
};

const Violation = mongoose.model('Violation', violationSchema);

export default Violation;

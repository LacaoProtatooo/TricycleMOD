import mongoose from "mongoose";

// Schema for individual ride diagnostic answers
const diagnosticAnswerSchema = new mongoose.Schema({
    categoryId: {
        type: String,
        required: true,
        trim: true
    },
    symptomId: {
        type: String,
        required: true,
        trim: true
    },
    symptom: {
        type: String,
        trim: true
    },
    severity: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    urgency: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    partsToCheck: [{
        type: String,
        trim: true
    }]
}, { _id: false });

// Schema for ride diagnostic records
const rideDiagnosticSchema = new mongoose.Schema({
    tricycleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tricycle',
        required: true
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    overallRating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    answers: {
        type: Map,
        of: String,
        default: {}
    },
    diagnostics: [diagnosticAnswerSchema],
    issueCount: {
        type: Number,
        default: 0
    },
    criticalCount: {
        type: Number,
        default: 0
    },
    highCount: {
        type: Number,
        default: 0
    },
    mediumCount: {
        type: Number,
        default: 0
    },
    motorcycleModel: {
        type: String,
        default: 'Motorcycle',
        trim: true
    },
    odometerReading: {
        type: Number,
        min: 0,
        default: null
    },
    drivingConditions: {
        type: String,
        enum: ['city', 'highway', 'rough_roads', 'mixed'],
        default: 'mixed'
    },
    dailyUsageHours: {
        type: Number,
        min: 0,
        max: 24,
        default: null
    },
    surveyedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for odometer-based queries
rideDiagnosticSchema.index({ tricycleId: 1, odometerReading: 1 });

// Indexes for efficient querying
rideDiagnosticSchema.index({ tricycleId: 1, surveyedAt: -1 });
rideDiagnosticSchema.index({ submittedBy: 1, surveyedAt: -1 });
rideDiagnosticSchema.index({ overallRating: 1 });

export const RideDiagnostic = mongoose.model('RideDiagnostic', rideDiagnosticSchema);

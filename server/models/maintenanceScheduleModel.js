import mongoose from "mongoose";

// Schema for individual maintenance items within a group
const maintenanceItemSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    notes: {
        type: String,
        trim: true
    }
}, { _id: false });

// Schema for maintenance schedule groups
const maintenanceScheduleGroupSchema = new mongoose.Schema({
    groupId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    intervalKm: {
        type: Number,
        required: true,
        min: 0
    },
    baselineDays: {
        type: Number,
        required: true,
        min: 1
    },
    reminderLabel: {
        type: String,
        required: true,
        trim: true
    },
    items: [maintenanceItemSchema],
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Schema for skip reasons (configurable by admin)
const skipReasonSchema = new mongoose.Schema({
    reasonId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    label: {
        type: String,
        required: true,
        trim: true
    },
    icon: {
        type: String,
        default: 'ellipsis-horizontal-outline'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Schema for completion status options (configurable by admin)
const completionStatusSchema = new mongoose.Schema({
    statusId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    label: {
        type: String,
        required: true,
        trim: true
    },
    icon: {
        type: String,
        default: 'checkmark-circle'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Schema for maintenance log records (per tricycle)
const maintenanceLogSchema = new mongoose.Schema({
    tricycleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tricycle',
        required: true
    },
    itemKey: {
        type: String,
        required: true,
        trim: true
    },
    lastServiceKm: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['completed', 'replaced', 'repaired', 'adjusted', 'inspected'],
        default: 'completed'
    },
    reading: {
        type: String,
        trim: true
    },
    notes: {
        type: String,
        trim: true
    },
    cost: {
        type: Number,
        min: 0
    },
    proofImageUrl: {
        type: String,
        trim: true
    },
    completedAt: {
        type: Date,
        default: Date.now
    },
    completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Approval workflow fields
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        trim: true
    },
    submittedByRole: {
        type: String,
        enum: ['driver', 'operator'],
        default: 'driver'
    }
}, { timestamps: true });

// Schema for skip/defer records (per tricycle)
const maintenanceSkipSchema = new mongoose.Schema({
    tricycleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tricycle',
        required: true
    },
    itemKey: {
        type: String,
        required: true,
        trim: true
    },
    reasonId: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    daysOverdue: {
        type: Number,
        default: 0
    },
    kmOverdue: {
        type: Number,
        default: 0
    },
    skippedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    skippedAt: {
        type: Date,
        default: Date.now
    },
    isResolved: {
        type: Boolean,
        default: false
    },
    resolvedAt: {
        type: Date
    }
}, { timestamps: true });

// Create indexes for better query performance
maintenanceLogSchema.index({ tricycleId: 1, itemKey: 1 });
maintenanceLogSchema.index({ tricycleId: 1, completedAt: -1 });
maintenanceSkipSchema.index({ tricycleId: 1, itemKey: 1 });
maintenanceSkipSchema.index({ tricycleId: 1, isResolved: 1 });

export const MaintenanceScheduleGroup = mongoose.model('MaintenanceScheduleGroup', maintenanceScheduleGroupSchema);
export const SkipReason = mongoose.model('SkipReason', skipReasonSchema);
export const CompletionStatus = mongoose.model('CompletionStatus', completionStatusSchema);
export const MaintenanceLog = mongoose.model('MaintenanceLog', maintenanceLogSchema);
export const MaintenanceSkip = mongoose.model('MaintenanceSkip', maintenanceSkipSchema);

import mongoose from 'mongoose';

const boundarySettlementSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tricycle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tricycle',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  settlementType: {
    type: String,
    enum: ['daily', 'weekly'],
    required: true
  },
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'confirmed', 'disputed'],
    default: 'pending'
  },
  paidAt: {
    type: Date
  },
  confirmedAt: {
    type: Date
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'gcash', 'bank_transfer', 'other'],
    default: 'cash'
  },
  referenceNumber: {
    type: String,
    trim: true
  }
}, { timestamps: true });

// Indexes for efficient queries
boundarySettlementSchema.index({ driver: 1, status: 1, createdAt: -1 });
boundarySettlementSchema.index({ operator: 1, status: 1, createdAt: -1 });
boundarySettlementSchema.index({ tricycle: 1, periodStart: 1, periodEnd: 1 });

const BoundarySettlement = mongoose.model('BoundarySettlement', boundarySettlementSchema);

export default BoundarySettlement;

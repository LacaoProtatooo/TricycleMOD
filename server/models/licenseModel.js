import mongoose from 'mongoose';

const licenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Enforce one license per user
  },
  licenseNumber: {
    type: String,
    required: false, // Allow draft saving without required fields
    unique: true, 
    sparse: true, // Allow multiple null/undefined values
    trim: true,
  },
  name: {
    type: String,
    required: false,
    trim: true,
  },
  birthdate: {
    type: Date,
    required: false,
  },
  address: {
    type: String,
    required: false,
  },
  sex: {
    type: String,
    enum: ['M', 'F', 'Male', 'Female'],
    required: false,
  },
  bloodType: {
    type: String,
    required: false,
  },
  restrictions: {
    type: String,
    required: false,
  },
  issuedDate: {
    type: Date,
    required: false,
  },
  expiryDate: {
    type: Date,
    required: false,
  },
  imageUrl: {
    type: String,
    required: [true, "License image URL is required"],
  },
  rawOcrText: {
    type: mongoose.Schema.Types.Mixed, // Can be array of strings or object
    required: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

const License = mongoose.model('License', licenseSchema);

export default License;

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
      type: String,
      required: [true, "Please enter your name"],
      maxLength: [30, "Your name cannot exceed 30 characters"],
      unique: true,
    },
  firstname: {
      type: String,
      required: [true, "Please enter your first name"],
      maxLength: [30, "Your first name cannot exceed 30 characters"],
    },
  lastname: {
      type: String,
      required: [true, "Please enter your last name"],
      maxLength: [30, "Your last name cannot exceed 30 characters"],
    },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
  address: {
      street: { type: String, required: false },
      city: { type: String, required: false },
      postalCode: { type: String, required: false },
      country: { type: String, required: false, default: 'Philippines' },
    },
  phone: {
      type: String,
      required: false,
      maxLength: [11, "Your phone number cannot exceed 11 characters"],
    },
  image: {
      public_id: {
        type: String,
        required: false,
      },
      url: {
        type: String,
        required: false,
      },
    },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
    },
  role: {
    type: String,
    enum: ['driver', 'operator'],
    default: 'driver'
    },
  isVerified: {
      type: Boolean,
      default: false,
    },
  FCMToken: {
      type: String,
      required: false,
    },
  rating: {
        type: Number,
        default: 0,
    },
  numReviews: {
        type: Number,
        default: 0,
    },
  reviews: {
        type: [mongoose.Schema.Types.ObjectId],  // Array of ObjectIds
        ref: "Review",                           // Reference to the 'Review' model
        default: [],                             // Default empty array for no reviews
    },
}, 
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

const User = mongoose.model('User', userSchema);

export default User;



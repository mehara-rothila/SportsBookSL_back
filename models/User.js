// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // Keep crypto

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide your name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    match: [ /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address', ],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false, // Don't send password back in queries by default
  },
  phone: { type: String, },
  address: { type: String, },
  avatar: { type: String, default: '/images/default-avatar.png', },
  role: { type: String, enum: ['user', 'trainer', 'facilityOwner', 'admin'], default: 'user', },
  sportPreferences: { type: [String], },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Facility', }],

  // --- Fields for OTP Reset ---
  resetPasswordToken: String,   // Store the HASHED OTP here
  resetPasswordExpire: Date,    // Store the expiry date
  // --- End Fields for OTP Reset ---

}, { timestamps: true });

// --- Middleware ---

// Hash password BEFORE saving the user document
userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified (or is new)
  if (!this.isModified('password')) {
    return next(); // If password isn't changed, skip hashing
  }

  // Hash the password with cost factor 10
  try {
    console.log(`[User Model] Hashing password for user: ${this.email}`); // Add log
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log(`[User Model] Password hashed successfully for: ${this.email}`); // Add log
    next();
  } catch (error) {
    console.error(`[User Model] Error hashing password for ${this.email}:`, error);
    next(error); // Pass error to Mongoose/Express error handler
  }
});

// --- Methods ---
// Method to compare entered password with the hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  // Ensure 'this.password' exists before comparing
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// --- MODIFIED METHOD: Generate and hash password reset OTP ---
userSchema.methods.getResetPasswordOtp = function () {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`[User Model] Generated Plain OTP: ${otp}`); // Log plain OTP ONLY during generation

  // Hash OTP and set to resetPasswordToken field
  const salt = bcrypt.genSaltSync(10);
  this.resetPasswordToken = bcrypt.hashSync(otp, salt); // Store HASHED OTP
  console.log(`[User Model] Storing Hashed OTP: ${this.resetPasswordToken}`);

  // Set expire time (e.g., 10 minutes from now)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Return the PLAIN OTP (to be emailed)
  return otp;
};
// --- END MODIFIED METHOD ---

module.exports = mongoose.model('User', userSchema);
// controllers/authController.js
const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose'); // Added for connection state checking

// --- Helper Function to Generate JWT ---
const generateToken = (id) => {
  if (!process.env.JWT_SECRET || !process.env.JWT_EXPIRE) {
      console.error('FATAL ERROR: JWT_SECRET or JWT_EXPIRE not defined in .env file');
      throw new Error('Server configuration error: JWT environment variables missing.');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  console.log("[registerUser] Registration attempt received.");
  const { name, email, password, phone, address } = req.body;

  // Check MongoDB connection
  console.log(`[registerUser] MongoDB connection state: ${mongoose.connection.readyState}`);

  if (!name || !email || !password) { res.status(400); throw new Error('Please provide name, email, and password'); }
  if (password.length < 6) { res.status(400); throw new Error('Password must be at least 6 characters long'); }

  const userExists = await User.findOne({ email });
  if (userExists) { console.warn(`[registerUser] User already exists: ${email}`); res.status(400); throw new Error('User already exists with this email'); }

  console.log(`[registerUser] Creating user document for: ${email}`);
  const user = await User.create({ name, email, password, phone, address });
  console.log(`[registerUser] User document created in memory (pre-save hooks run next)`);

  if (user) {
    console.log(`[registerUser] User saved successfully to DB for: ${email}. Generating token.`);
    const token = generateToken(user._id);
    res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role, token: token });
  } else {
    console.error(`[registerUser] User.create did not return a user object for ${email}, but also didn't throw error?`);
    res.status(400); throw new Error('Invalid user data during creation');
  }
});

// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  console.log(`[loginUser] Login attempt received for email: ${email}`);
  console.log(`[loginUser] Request body:`, JSON.stringify(req.body));
  
  // Check MongoDB connection
  console.log(`[loginUser] MongoDB connection state: ${mongoose.connection.readyState}`);

  if (!email || !password) { 
    console.log(`[loginUser] Missing email or password`);
    res.status(400); 
    throw new Error('Please provide email and password'); 
  }

  try {
    // Explicitly log DB query
    console.log(`[loginUser] Attempting to find user with email: ${email}`);
    const user = await User.findOne({ email }).select('+password');

    if (!user) { 
      console.log(`[loginUser] User not found: ${email}`); 
      res.status(401); 
      throw new Error('Invalid email or password'); 
    }

    console.log(`[loginUser] User found: ${user.email}, ID: ${user._id}`);
    console.log(`[loginUser] Password field exists: ${!!user.password}, Length: ${user.password?.length || 0}`);
    
    try {
      // Log matchPassword attempt
      console.log(`[loginUser] Attempting to match password for user: ${user.email}`);
      const isMatch = await user.matchPassword(password);
      console.log(`[loginUser] Password match result for ${user.email}: ${isMatch}`);
      
      if (isMatch) {
        console.log(`[loginUser] Login successful for ${user.email}. Generating token.`);
        const token = generateToken(user._id);
        res.json({ 
          _id: user._id, 
          name: user.name, 
          email: user.email, 
          role: user.role, 
          avatar: user.avatar, 
          token: token 
        });
      } else {
        console.log(`[loginUser] Invalid password provided for ${user.email}`);
        res.status(401); 
        throw new Error('Invalid email or password');
      }
    } catch (matchErr) {
      console.error(`[loginUser] Error during password match:`, matchErr);
      res.status(500);
      throw new Error('Server error during authentication');
    }
  } catch (err) {
    console.error(`[loginUser] Unhandled error:`, err);
    if (!res.statusCode || res.statusCode === 200) {
      res.status(500);
    }
    throw err;
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private (Requires token)
const getMe = asyncHandler(async (req, res) => {
  console.log(`[getMe] Fetching profile for user ID: ${req.user?.id}`);
  const user = await User.findById(req.user.id).select('-password');
  if (!user) { console.warn(`[getMe] User not found in DB for ID: ${req.user.id}`); res.status(404); throw new Error('User not found'); }
  console.log(`[getMe] Profile found for user: ${user.email}`);
  res.status(200).json(user);
});


// ========================================
// --- Password Reset Functionality (OTP) ---
// ========================================

// @desc    Forgot Password - Generate OTP & Send Email
// @route   POST /api/auth/forgotpassword
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  console.log(`[forgotPassword] Request received for email: ${email}`);

  if (!email) {
    res.status(400);
    throw new Error('Please provide an email address');
  }

  const user = await User.findOne({ email });

  if (!user) {
    console.log(`[forgotPassword] User not found (or pretending not to find): ${email}`);
    res.status(200).json({ success: true, message: 'If an account exists for this email, a password reset OTP has been sent.' });
    return;
  }

  // Generate reset OTP (plain OTP) using the method on the user model
  const resetOtp = user.getResetPasswordOtp(); // This also hashes and sets fields

  // Save the user document with the HASHED OTP and expiry date
  try {
    await user.save({ validateBeforeSave: false });
    console.log(`[forgotPassword] Hashed reset OTP saved for user: ${email}`);
  } catch (saveError) {
     console.error(`[forgotPassword] Error saving user with reset OTP: ${email}`, saveError);
     user.resetPasswordToken = undefined; // Use resetPasswordToken field to store hashed OTP
     user.resetPasswordExpire = undefined;
     res.status(500);
     throw new Error('Error generating reset OTP. Please try again.');
  }

  // Create email message with PLAIN OTP
  const message = `
    <div style="font-family: sans-serif; line-height: 1.6;">
        <h1 style="color: #059669;">Password Reset Request</h1>
        <p>You requested a password reset for your SportsBookSL account.</p>
        <p>Your One-Time Password (OTP) is:</p>
        <p style="font-size: 24px; font-weight: bold; color: #10B981; border: 1px dashed #10B981; padding: 10px; display: inline-block; letter-spacing: 3px;">
            ${resetOtp}
        </p>
        <p>This OTP will expire in <strong>10 minutes</strong>.</p>
        <p>Enter this code on the password reset page.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 0.9em; color: #6b7280;">If you did not request this password reset, please ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: 'SportsBookSL Password Reset OTP',
      html: message,
    });
    console.log(`[forgotPassword] Reset OTP email sent successfully to: ${email}`);
    res.status(200).json({ success: true, message: 'Password reset OTP sent successfully.' });
  } catch (emailError) {
    console.error(`[forgotPassword] Error sending reset OTP email to ${email}:`, emailError);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    try { await user.save({ validateBeforeSave: false }); } catch (clearSaveError) { console.error("Failed to clear reset token after email error:", clearSaveError); }
    res.status(500);
    throw new Error('Email could not be sent. Please try again later.');
  }
});

// @desc    Reset Password using Email, OTP and New Password
// @route   PUT /api/auth/resetpassword
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body; // Get email, OTP, password from body

  console.log(`[resetPassword] Attempt received for email: ${email}, OTP: ${otp ? 'present' : 'missing'}`);

  if (!email || !otp || !password) {
      res.status(400); throw new Error('Please provide email, OTP, and new password.');
  }
   if (password.length < 6) {
      res.status(400); throw new Error('Password must be at least 6 characters long.');
  }

  // Find user by email who potentially has an active token
  const user = await User.findOne({
    email: email,
    resetPasswordToken: { $exists: true, $ne: null }, // Hashed OTP stored here
    resetPasswordExpire: { $gt: Date.now() }
  }).select('+resetPasswordToken +password'); // Select fields needed

  if (!user) {
    console.log(`[resetPassword] No user found for email ${email} with an active, valid reset token/OTP request.`);
    res.status(400);
    throw new Error('Invalid OTP, expired, or no pending reset request found for this email.');
  }

  // Compare the received PLAIN OTP with the HASHED OTP in the database
  const isOtpMatch = await bcrypt.compare(otp, user.resetPasswordToken);

  if (!isOtpMatch) {
      console.log(`[resetPassword] OTP mismatch for user: ${email}`);
      res.status(400);
      throw new Error('Invalid OTP.');
  }

  // OTP is valid and user found, set the new password
  user.password = password; // Assign plain password, pre-save hook will hash it
  user.resetPasswordToken = undefined; // Clear the OTP fields
  user.resetPasswordExpire = undefined;

  try {
      await user.save(); // Let pre-save hook hash the new password
      console.log(`[resetPassword] Password reset successfully for user: ${user.email}`);

      // Optional: Send password change confirmation email
      try {
           await sendEmail({
               email: user.email,
               subject: 'Your SportsBookSL Password Has Been Changed',
               html: `<p>Hi ${user.name || 'User'},</p><p>This email confirms that the password for your SportsBookSL account associated with ${user.email} has been successfully changed.</p><p>If you did not make this change, please contact support immediately.</p>`
           });
      } catch (confirmEmailError) {
           console.error(`[resetPassword] Failed to send password change confirmation email to ${user.email}:`, confirmEmailError);
      }

      res.status(200).json({ success: true, message: 'Password reset successful.' });

  } catch(saveError) {
      console.error(`[resetPassword] Error saving user after password reset: ${user.email}`, saveError);
      res.status(500);
      throw new Error('Error resetting password. Please try again.');
  }
});

module.exports = {
  registerUser,
  loginUser,
  getMe,
  forgotPassword,
  resetPassword,
};
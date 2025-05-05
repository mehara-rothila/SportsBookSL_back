// routes/api/auth.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../../models/User'); // Add this import
const {
  registerUser,
  loginUser,
  getMe,
  forgotPassword,
  resetPassword,
} = require('../../controllers/authController');
const { protect } = require('../../middleware/authMiddleware');

router.use(express.json()); // Apply JSON parser

// --- Standard Auth Routes ---
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword', resetPassword);

// --- Diagnostic Routes ---

// Check if a specific user exists
router.get('/check-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    console.log(`[check-user] Checking if user exists: ${email}`);
    
    console.log(`[check-user] MongoDB connection state: ${mongoose.connection.readyState}`);
    
    const user = await User.findOne({ email }).select('email');
    
    res.json({
      userExists: !!user,
      dbConnected: mongoose.connection.readyState === 1,
      email: email
    });
  } catch (error) {
    console.error(`[check-user] Error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Test database connection
router.get('/test-db', async (req, res) => {
  try {
    console.log('[test-db] Testing database connection');
    const connectionState = mongoose.connection.readyState;
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    // Get count of users as a connection test
    const userCount = await User.countDocuments();
    
    res.json({
      dbState: connectionState,
      dbStateText: stateMap[connectionState] || 'unknown',
      userCount: userCount,
      envVars: {
        nodeEnv: process.env.NODE_ENV,
        mongoUri: process.env.MONGO_URI ? 'Set (not showing value)' : 'Not set',
        jwtSecret: process.env.JWT_SECRET ? 'Set (not showing value)' : 'Not set',
        jwtExpire: process.env.JWT_EXPIRE,
        backendBaseUrl: process.env.BACKEND_BASE_URL || 'Not set'
      }
    });
  } catch (error) {
    console.error('[test-db] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test image URL transformation
router.get('/check-image-transformation', async (req, res) => {
  try {
    res.json({
      success: true,
      testImageRelative: '/uploads/test.jpg',
      testAvatar: '/uploads/avatars/default.jpg',
      backendUrl: process.env.BACKEND_BASE_URL || 'Not set',
      transformationActive: true,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a test login route that tries with hard-coded credentials
router.get('/test-login/:email', async (req, res) => {
  try {
    const { email } = req.params;
    console.log(`[test-login] Testing login functionality for: ${email}`);
    
    // Check MongoDB connection
    console.log(`[test-login] MongoDB connection state: ${mongoose.connection.readyState}`);
    
    // Find user by email with password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.json({
        status: 'error',
        message: 'User not found',
        email: email
      });
    }
    
    res.json({
      status: 'success',
      userFound: true,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0,
      // Don't include actual password hash for security
      userId: user._id,
      userRole: user.role,
      // Include matchPassword method availability
      hasMatchPasswordMethod: typeof user.matchPassword === 'function'
    });
  } catch (error) {
    console.error(`[test-login] Error:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
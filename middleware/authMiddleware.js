// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User'); // Assuming path is correct

const protect = asyncHandler(async (req, res, next) => {
  let token;
  // **** ADDED LOG ****
  console.log(`[Protect] Request received for: ${req.method} ${req.originalUrl}`); // Log entry

  // Check for token in Authorization header (Bearer token)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      // **** ADDED LOG ****
      console.log('[Protect] Token found in header.'); // Log token found

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // **** ADDED LOG ****
      console.log('[Protect] Token verified. Decoded ID:', decoded.id); // Log decoded ID

      // Get user from the token (select -password to exclude)
      // Ensure the User model path is correct relative to this file
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
          // **** ADDED LOG ****
          console.error(`[Protect] User not found in DB for ID: ${decoded.id}`); // Log user not found
          res.status(401);
          throw new Error('Not authorized, user not found');
      }

      // **** ADDED LOG ****
      console.log(`[Protect] User attached to req: ${req.user._id}`); // Log successful user attachment
      next(); // Proceed to the next middleware/route handler
    } catch (error) {
      // **** ADDED LOG ****
      console.error('[Protect] Token verification failed:', error.message); // Log specific error
      res.status(401); // Unauthorized
      throw new Error('Not authorized, token failed');
    }
  } else {
      // **** ADDED LOG ****
      console.log('[Protect] No Bearer token found in Authorization header.');
      // Original check for !token handles this, but explicit log helps
      if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token provided');
      }
  }
});

// --- Optional: Authorization Middleware (Example for Admin) ---
const admin = (req, res, next) => {
    // Ensure protect middleware runs first to attach req.user
    if (req.user && req.user.role === 'admin') {
        next(); // User is admin, proceed
    } else {
        res.status(403); // Forbidden
        throw new Error('Not authorized as an admin');
    }
};


module.exports = { protect, admin };
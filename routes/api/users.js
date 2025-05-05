// routes/api/users.js
const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  updateUserProfile,
  getUserBookings,
  getUserFavorites,
  addFavorite,
  removeFavorite,
  getUserFinancialAidApps,
  updateUserAvatar,
  removeUserAvatar, // New controller function for removing avatar
  getUserDonationHistory, // Added for donation history
} = require('../../controllers/userController');
const { protect } = require('../../middleware/authMiddleware');
const { uploadAvatar } = require('../../middleware/uploadMiddleware');

// Apply JSON parser for routes expecting JSON body
router.use(express.json());

// Protect all subsequent routes in this file
router.use(protect);

// --- Avatar Upload/Remove Routes ---
router.route('/profile/avatar')
    .put(uploadAvatar, updateUserAvatar)
    .delete(removeUserAvatar); // Add DELETE endpoint for avatar removal

// --- Other Profile Routes ---
router.route('/profile')
  .get(getUserProfile)
  .put(updateUserProfile);

// --- Booking routes ---
router.route('/bookings')
  .get(getUserBookings);

// --- Favorite routes ---
router.route('/favorites')
  .get(getUserFavorites)
  .post(addFavorite);

router.route('/favorites/:facilityId')
  .delete(removeFavorite);

// --- Financial Aid routes ---
router.route('/financial-aid')
    .get(getUserFinancialAidApps);

// --- Donation History routes ---
router.route('/donations/history')
    .get(getUserDonationHistory);

module.exports = router;
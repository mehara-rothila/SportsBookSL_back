// routes/api/donations.js
const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware');
const {
    makeDonation,
    getSuccessStories,
} = require('../../controllers/donationController');

// **** ADD THIS LINE ****
router.use(express.json()); // Apply JSON parser for this router

// Note: Routes for getting athlete lists/details are in athletes.js

// POST /api/donations/athletes/:id/donate - Make a donation (protected, expects JSON body)
router.route('/athletes/:id/donate')
    .post(protect, makeDonation);

// GET /api/donations/success-stories - Get success stories (public)
router.route('/success-stories')
    .get(getSuccessStories);

// --- TODO: Add route for user's donation history ---

module.exports = router;
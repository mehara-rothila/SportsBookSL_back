// routes/api/reviews.js
const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware');
const {
    updateReview,
    deleteReview,
    // getReviewById // Optional: if needed to get a single review directly
} = require('../../controllers/reviewController');

// **** ADD THIS LINE ****
router.use(express.json()); // Apply JSON parser for this router

// --- Protected Routes ---
// Routes for modifying/deleting specific reviews usually require login

// PUT /api/reviews/:id - Update a specific review (user must own the review)
// router.route('/:id')
//     .put(protect, updateReview); // TODO: Implement updateReview in controller

// DELETE /api/reviews/:id - Delete a specific review (user must own the review or be admin)
// router.route('/:id')
//     .delete(protect, deleteReview); // TODO: Implement deleteReview in controller

// GET /api/reviews/:id - Get a single review (Optional - might not be needed)
// router.route('/:id')
//     .get(getReviewById); // TODO: Implement getReviewById if needed


// --- Export the router ---
module.exports = router;
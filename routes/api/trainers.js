// routes/api/trainers.js
const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware');
const {
    getTrainers,
    getTrainerById,
    getTrainerReviews,
    bookSession,
} = require('../../controllers/trainerController');
const { addTrainerReview } = require('../../controllers/reviewController');

// **** Keep global JSON parser for this router if other routes need it ****
router.use(express.json());

// Public routes
router.route('/')
    .get(getTrainers);

router.route('/:id')
    .get(getTrainerById);

router.route('/:id/reviews')
    .get(getTrainerReviews)
    // **** Ensure controller runs AFTER express.json() is applied ****
    .post(protect, addTrainerReview); // Needs JSON, already covered by router.use() above

// Booking requires login and JSON body
router.route('/:id/book')
    .post(protect, bookSession); // Needs JSON, already covered by router.use() above

module.exports = router;
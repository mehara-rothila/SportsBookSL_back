// controllers/reviewController.js
const asyncHandler = require('express-async-handler');
const Review = require('../models/Review');
const Facility = require('../models/Facility');
const Trainer = require('../models/Trainer'); // Needed for adding trainer reviews
const mongoose = require('mongoose');

// @desc    Add a review for a facility
// @route   POST /api/facilities/:id/reviews
// @access  Private
const addFacilityReview = asyncHandler(async (req, res) => {
    // This expects req.body to be populated by express.json()
    const { rating, content } = req.body; // <<< This line should now work
    const facilityId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(facilityId)) {
        res.status(400);
        throw new Error('Invalid Facility ID format');
    }

    if (!rating || !content) {
        res.status(400);
        throw new Error('Rating and content are required');
    }

    const facility = await Facility.findById(facilityId);

    if (!facility) {
        res.status(404);
        throw new Error('Facility not found');
    }

    // Check if user already reviewed this facility
    const alreadyReviewed = await Review.findOne({
        facility: facilityId,
        user: req.user._id, // req.user comes from 'protect' middleware
    });

    if (alreadyReviewed) {
        res.status(400);
        throw new Error('You have already reviewed this facility');
    }

    // Create the review
    const review = new Review({
        rating: Number(rating),
        content,
        user: req.user._id,
        facility: facilityId,
    });

    await review.save();

    // Note: Average rating calculation is handled by post-save hook in Review model

    res.status(201).json({ message: 'Review added successfully for facility', review });
});

// @desc    Add a review for a trainer
// @route   POST /api/trainers/:id/reviews
// @access  Private
const addTrainerReview = asyncHandler(async (req, res) => {
    // This expects req.body to be populated by express.json()
    const { rating, content } = req.body; // <<< This line should now work
    const trainerId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(trainerId)) {
        res.status(400);
        throw new Error('Invalid Trainer ID format');
    }

     if (!rating || !content) {
        res.status(400);
        throw new Error('Rating and content are required');
    }

    const trainer = await Trainer.findById(trainerId);

    if (!trainer) {
        res.status(404);
        throw new Error('Trainer not found');
    }

    // Check if user already reviewed this trainer
    const alreadyReviewed = await Review.findOne({
        trainer: trainerId,
        user: req.user._id,
    });

     if (alreadyReviewed) {
        res.status(400);
        throw new Error('You have already reviewed this trainer');
    }

    // Create the review
    const review = new Review({
        rating: Number(rating),
        content,
        user: req.user._id,
        trainer: trainerId, // Link review to the trainer
    });

    await review.save();

    // Note: Average rating calculation is handled by post-save hook in Review model

    res.status(201).json({ message: 'Review added successfully for trainer', review });
});


// --- Placeholder for Update ---
const updateReview = asyncHandler(async (req, res) => {
    // TODO: Implement logic to find review, check ownership, update, save
    res.status(200).json({ message: `Update review ${req.params.id} (logic pending)` });
});

// --- Placeholder for Delete ---
const deleteReview = asyncHandler(async (req, res) => {
    // TODO: Implement logic to find review, check ownership or admin role, remove
    // Remember to trigger the pre/post remove hooks for rating recalculation
    const review = await Review.findById(req.params.id);
    if (review) {
        // Add authorization check here (req.user.id === review.user.toString() || req.user.role === 'admin')
        // await review.remove(); // This should trigger the hooks
        res.status(200).json({ message: `Delete review ${req.params.id} (logic pending)` });
    } else {
        res.status(404);
        throw new Error('Review not found');
    }
});

// --- Export the functions ---
module.exports = {
    addFacilityReview,
    addTrainerReview, // Make sure this is exported
    updateReview,
    deleteReview,
};
// routes/api/facilities.js
const express = require('express');
const router = express.Router();
const {
    createFacility,
    getFacilities,
    getFeaturedFacilities,
    getFacilityById,
    getFacilityAvailability,
    getFacilityReviews,
} = require('../../controllers/facilityController');
const { protect, admin } = require('../../middleware/authMiddleware');
const { addFacilityReview } = require('../../controllers/reviewController');
const { uploadFacilityImages } = require('../../middleware/uploadMiddleware');

// Public routes first
router.route('/featured')
    .get(getFeaturedFacilities);

router.route('/:id/availability')
    .get(getFacilityAvailability);

// Reviews routes
router.route('/:id/reviews')
    .get(getFacilityReviews)
    // **** FIX: Add express.json() before the controller for POST ****
    .post(protect, express.json(), addFacilityReview); // Add express.json() HERE

// Single facility details (public)
router.route('/:id')
    .get(getFacilityById);

// Route for GET all facilities (public) and POST create facility (admin)
router.route('/')
    .get(getFacilities)
    .post(protect, admin, uploadFacilityImages, createFacility); // This route uses Multer, NOT express.json()

module.exports = router;
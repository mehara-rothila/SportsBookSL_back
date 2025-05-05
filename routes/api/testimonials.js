// routes/api/testimonials.js
const express = require('express');
const router = express.Router();
const {
    getActiveTestimonials,
    createTestimonial
} = require('../../controllers/testimonialController');
const { uploadTestimonialImage } = require('../../middleware/uploadMiddleware');
const { protect, admin } = require('../../middleware/authMiddleware');

// Public route to get testimonials
router.route('/')
    .get(getActiveTestimonials);

// Protected Admin route to create a testimonial
router.route('/')
    // VVVVVV --- TEMPORARILY COMMENTED OUT FOR HTML TESTING --- VVVVVV
    .post( /* protect, admin, */ uploadTestimonialImage, createTestimonial);
    // ^^^^^^ --- TEMPORARILY COMMENTED OUT FOR HTML TESTING --- ^^^^^^

// --- TODO: Add routes for PUT update, DELETE ---

module.exports = router;
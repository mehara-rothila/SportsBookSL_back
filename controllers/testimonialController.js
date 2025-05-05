// controllers/testimonialController.js
const Testimonial = require('../models/Testimonial');
const asyncHandler = require('express-async-handler');

// @desc    Get active testimonials
// @route   GET /api/testimonials
// @access  Public
const getActiveTestimonials = asyncHandler(async (req, res) => {
  const testimonials = await Testimonial.find({ isActive: true }).sort({ createdAt: -1 }); // Sort by newest
  res.json(testimonials);
});

// @desc    Create a new testimonial
// @route   POST /api/testimonials
// @access  Private/Admin (Apply middleware in routes)
const createTestimonial = asyncHandler(async (req, res) => {
    // Check for file validation errors from Multer filter
    if (req.fileValidationError) {
        res.status(400);
        throw new Error(req.fileValidationError);
    }

    const { content, author, role, isActive } = req.body;

    // Basic Validation
    if (!content || !author) {
        res.status(400);
        throw new Error('Content and Author are required');
    }

    let imagePath = null; // Default to null if no image uploaded
    if (req.file) {
        // Construct the relative path to store in DB
        imagePath = `/uploads/testimonials/${req.file.filename}`;
    } else {
        // Optional: Set a default image path if no file is uploaded
        // imagePath = '/images/default-avatar.png';
    }

    const testimonial = new Testimonial({
        content,
        author,
        role,
        imageUrl: imagePath, // Store the server path or null/default
        // Convert 'isActive' from form data (might be string 'true' or checkbox value)
        isActive: isActive === 'true' || isActive === true || req.body.isActive === 'on',
    });

    const createdTestimonial = await testimonial.save();
    res.status(201).json(createdTestimonial);
});


// --- TODO: Add Update and Delete functions later ---
// const updateTestimonial = asyncHandler(async (req, res) => { ... });
// const deleteTestimonial = asyncHandler(async (req, res) => { ... });

module.exports = {
  getActiveTestimonials,
  createTestimonial, // Export the new function
  // updateTestimonial,
  // deleteTestimonial,
};
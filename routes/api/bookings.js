// routes/api/bookings.js
const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware'); // Keep the import
const {
    createBooking,
    getBookingById,
    cancelBooking,
    getBookingConfirmation // Assuming this uses getBookingById internally
} = require('../../controllers/bookingController');

// **** ADD THIS LINE ****
router.use(express.json()); // Apply JSON parser for this router

// POST /api/bookings - Create a new booking
router.route('/')
    .post(protect, createBooking);  // UNCOMMENTED protect middleware here

// GET /api/bookings/:id - Get specific booking details
router.route('/:id')
    .get(protect, getBookingById);  // UNCOMMENTED protect middleware here

// PUT /api/bookings/:id/cancel - Cancel a booking (Still Protected - Requires Login)
router.route('/:id/cancel')
    .put(protect, cancelBooking);

// GET /api/bookings/confirmation/:id - Get confirmation details
// For a public confirmation page, you might want to create a separate controller function
// that doesn't require authentication or doesn't check booking ownership
router.route('/confirmation/:id')
    .get(protect, getBookingConfirmation);  // UNCOMMENTED protect middleware here

module.exports = router;
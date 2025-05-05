// routes/index.js
const express = require('express');
const router = express.Router();

// --- Import all route files ---
const authRoutes = require('./api/auth');
const userRoutes = require('./api/users');
const categoryRoutes = require('./api/categories');
const facilityRoutes = require('./api/facilities');
const bookingRoutes = require('./api/bookings');
const trainerRoutes = require('./api/trainers');
const athleteRoutes = require('./api/athletes');
const donationRoutes = require('./api/donations');
const financialAidRoutes = require('./api/financialAid');
const reviewRoutes = require('./api/reviews');
const testimonialRoutes = require('./api/testimonials');
const utilityRoutes = require('./api/utils');
const weatherRoutes = require('./api/weather');
const adminRoutes = require('./api/admin');
const notificationRoutes = require('./api/notifications'); // <--- IMPORTED Notification Routes

// --- Mount all routes ---
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/facilities', facilityRoutes);
router.use('/bookings', bookingRoutes);
router.use('/trainers', trainerRoutes);
router.use('/athletes', athleteRoutes);
router.use('/donations', donationRoutes);
router.use('/financial-aid', financialAidRoutes);
router.use('/reviews', reviewRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/utils', utilityRoutes);
router.use('/weather', weatherRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes); // <--- MOUNTED Notification Routes


// Update to routes/index.js (adding these lines)
const trainerApplicationRoutes = require('./api/trainerApplications');

// Mount routes
router.use('/trainer-applications', trainerApplicationRoutes);
router.use('/admin/trainer-applications', trainerApplicationRoutes);

module.exports = router;
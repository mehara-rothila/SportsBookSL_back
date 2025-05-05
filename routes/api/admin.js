// sportsbook-sl-backend/routes/api/admin.js
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../../middleware/authMiddleware');
// Import all necessary upload middleware
const {
    uploadFacilityImages,
    uploadTrainerImage,
    uploadTestimonialImage,
    uploadAthleteImage
} = require('../../middleware/uploadMiddleware');
// Import ALL controller functions needed
const {
    // User Controllers
    getAllUsers, updateUserByAdmin, deleteUserByAdmin,
    // Facility Controllers
    getAllAdminFacilities, getAdminFacilityById, updateFacilityByAdmin, deleteFacilityByAdmin,
    // Trainer Controllers
    getAllAdminTrainers, getAdminTrainerById, createTrainerByAdmin, updateTrainerByAdmin, deleteTrainerByAdmin,
    // Booking Controllers
    getAllAdminBookings, updateBookingStatusByAdmin, deleteBookingByAdmin,
    // Testimonial Controllers
    getAllAdminTestimonials, createAdminTestimonial, updateAdminTestimonial, deleteAdminTestimonial,
    // Athlete Controllers
    getAllAdminAthletes, getAdminAthleteById, createAdminAthlete, updateAdminAthlete, deleteAdminAthlete,
    // Donation Controllers
    getAllAdminDonations,
    // Financial Aid Controllers (NEW)
    getAllAdminAidApplications, getAdminAidApplicationById, updateAdminAidApplicationStatus,
} = require('../../controllers/adminController');

// --- Apply Auth Middleware Globally ---
router.use(protect); // Ensure user is logged in
router.use(admin);   // Ensure user has admin role

// --- User Routes ---
router.route('/users').get(getAllUsers);
router.route('/users/:id').put(express.json(), updateUserByAdmin).delete(deleteUserByAdmin);

// --- Facility Routes ---
router.route('/facilities').get(getAllAdminFacilities);
router.route('/facilities/:id').get(getAdminFacilityById).put(uploadFacilityImages, updateFacilityByAdmin).delete(deleteFacilityByAdmin);

// --- Trainer Routes ---
router.route('/trainers').get(getAllAdminTrainers).post(uploadTrainerImage, createTrainerByAdmin);
router.route('/trainers/:id').get(getAdminTrainerById).put(uploadTrainerImage, updateTrainerByAdmin).delete(deleteTrainerByAdmin);

// --- Booking Routes ---
router.route('/bookings').get(getAllAdminBookings);
router.route('/bookings/:id/status').put(express.json(), updateBookingStatusByAdmin);
router.route('/bookings/:id').delete(deleteBookingByAdmin);

// --- Testimonial Routes ---
router.route('/testimonials').get(getAllAdminTestimonials).post(uploadTestimonialImage, createAdminTestimonial);
router.route('/testimonials/:id').put(uploadTestimonialImage, updateAdminTestimonial).delete(deleteAdminTestimonial);

// --- Athlete Management Routes ---
router.route('/athletes').get(getAllAdminAthletes).post(uploadAthleteImage, createAdminAthlete);
router.route('/athletes/:id').get(getAdminAthleteById).put(uploadAthleteImage, updateAdminAthlete).delete(deleteAdminAthlete);

// --- Donation Management Routes ---
router.route('/donations').get(getAllAdminDonations);

// --- Financial Aid Management Routes (NEW) ---
router.route('/financial-aid')
    .get(getAllAdminAidApplications);        // GET /api/admin/financial-aid

router.route('/financial-aid/:id')
    .get(getAdminAidApplicationById)       // GET /api/admin/financial-aid/:id
    .put(express.json(), updateAdminAidApplicationStatus); // PUT /api/admin/financial-aid/:id


module.exports = router;
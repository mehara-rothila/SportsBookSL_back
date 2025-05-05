// routes/api/financialAid.js
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../../middleware/authMiddleware');
const {
    submitApplication,
    getUserApplications,
    getApplicationDetails,
} = require('../../controllers/financialAidController');
const { uploadFinancialAidDocs } = require('../../middleware/uploadMiddleware');

// NO router.use(express.json()) here because this route uses Multer

// POST /api/financial-aid/apply - Submit application (protected)
// Uses Multer middleware to parse multipart/form-data
router.route('/apply')
    // protect middleware ensures user is logged in
    // uploadFinancialAidDocs handles file uploads and populates req.body and req.files
    // submitApplication is the controller function
    .post(protect, uploadFinancialAidDocs, submitApplication);

// GET /api/financial-aid/my-applications - Get current user's applications (protected)
router.route('/my-applications')
    .get(protect, getUserApplications); // Keep protect here

// GET /api/financial-aid/applications/:id - Get application details (protected)
router.route('/applications/:id')
    .get(protect, getApplicationDetails);

// --- Admin Routes (Example - Implement in admin.js) ---
/*
// These would typically be in routes/api/admin.js and use adminController functions

router.route('/admin/applications') // Example route structure
    .get(protect, admin, getAllAdminApplications); // Fetch all applications

router.route('/admin/applications/:id') // Example route structure
    .get(protect, admin, getAdminApplicationById) // Fetch one application
    .put(protect, admin, express.json(), updateAdminApplicationStatus); // Update status (needs JSON body)
*/

module.exports = router;
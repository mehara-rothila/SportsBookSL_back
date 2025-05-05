// routes/api/trainerApplications.js
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../../middleware/authMiddleware');
const { uploadTrainerImage } = require('../../middleware/uploadMiddleware');
const {
  submitTrainerApplication,
  getUserApplications,
  getAllApplications,
  getApplicationById,
  approveApplication,
  rejectApplication
} = require('../../controllers/trainerApplicationController');

// Public/regular user routes (protected by auth)
router.post('/', protect, uploadTrainerImage, submitTrainerApplication);
router.get('/user', protect, getUserApplications);

// Admin routes
router.get('/', protect, admin, getAllApplications);
router.get('/:id', protect, admin, getApplicationById);
router.put('/:id/approve', protect, admin, approveApplication);
router.put('/:id/reject', protect, admin, rejectApplication);

module.exports = router;
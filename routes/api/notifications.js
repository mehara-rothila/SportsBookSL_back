// routes/api/notifications.js
const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware'); // Needs user auth
const {
    getUserNotifications,
    markNotificationsRead,
    deleteNotification
} = require('../../controllers/notificationController'); // Adjust path

// All routes in this file require login
router.use(protect);

// Get user's notifications
router.route('/')
    .get(getUserNotifications);

// Mark notifications as read
router.route('/mark-read')
    .put(express.json(), markNotificationsRead); // Requires JSON body { notificationIds: [...] } or { markAll: true }

// Delete a specific notification
router.route('/:id')
    .delete(deleteNotification);

module.exports = router;
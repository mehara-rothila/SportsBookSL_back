// controllers/notificationController.js
const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification'); // Adjust path
const mongoose = require('mongoose');

// @desc    Get notifications for the logged-in user
// @route   GET /api/notifications
// @access  Private
const getUserNotifications = asyncHandler(async (req, res) => {
    const userId = req.user._id; // From protect middleware

    // Pagination (optional, recommended for long lists)
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10; // Limit how many are fetched initially
    const skip = (page - 1) * limit;

    // Fetch latest notifications for the user
    const notifications = await Notification.find({ user: userId })
        .sort({ createdAt: -1 }) // Newest first
        .limit(limit)
        .skip(skip)
        .lean(); // Use lean for performance

    // Get unread count separately (more efficient than filtering large arrays)
    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });

    // Could add total count/pages if pagination is fully implemented on frontend
    // const totalCount = await Notification.countDocuments({ user: userId });

    res.status(200).json({
        notifications,
        unreadCount,
        // currentPage: page,
        // totalPages: Math.ceil(totalCount / limit)
    });
});

// @desc    Mark notifications as read
// @route   PUT /api/notifications/mark-read
// @access  Private
const markNotificationsRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    // Expecting an array of notification IDs in the body, or a flag to mark all
    const { notificationIds, markAll } = req.body;

    let updateResult;

    if (markAll === true) {
        // Mark all notifications for the user as read
        updateResult = await Notification.updateMany(
            { user: userId, isRead: false },
            { $set: { isRead: true } }
        );
        console.log(`Marked all notifications as read for user ${userId}. Count: ${updateResult.modifiedCount}`);
    } else if (Array.isArray(notificationIds) && notificationIds.length > 0) {
        // Validate IDs
        const validIds = notificationIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if(validIds.length !== notificationIds.length) {
             console.warn(`Mark read request contained invalid IDs for user ${userId}`);
             // Continue with valid IDs only
        }
        if (validIds.length === 0) {
            res.status(400);
            throw new Error('No valid notification IDs provided to mark as read.');
        }

        // Mark specific notifications as read
        updateResult = await Notification.updateMany(
            { _id: { $in: validIds }, user: userId, isRead: false },
            { $set: { isRead: true } }
        );
        console.log(`Marked ${updateResult.modifiedCount} notifications as read for user ${userId}. IDs: ${validIds.join(', ')}`);

    } else {
        res.status(400);
        throw new Error('Invalid request body. Provide "notificationIds" array or "markAll: true".');
    }

    // Fetch updated unread count after marking
    const newUnreadCount = await Notification.countDocuments({ user: userId, isRead: false });

    res.status(200).json({
        success: true,
        message: `${updateResult?.modifiedCount || 0} notification(s) marked as read.`,
        unreadCount: newUnreadCount // Send back the new unread count
    });
});


// @desc    Delete a specific notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const notificationId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        res.status(400); throw new Error('Invalid Notification ID format');
    }

    const notification = await Notification.findOne({ _id: notificationId, user: userId });

    if (!notification) {
        res.status(404); throw new Error('Notification not found or you are not authorized to delete it.');
    }

    await Notification.deleteOne({ _id: notificationId });

    console.log(`Notification ${notificationId} deleted for user ${userId}.`);
    // Fetch updated unread count after deleting
    const newUnreadCount = await Notification.countDocuments({ user: userId, isRead: false });

    res.status(200).json({
        success: true,
        message: 'Notification deleted successfully.',
        unreadCount: newUnreadCount
     });
});


module.exports = {
    getUserNotifications,
    markNotificationsRead,
    deleteNotification
};
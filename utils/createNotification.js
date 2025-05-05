// utils/createNotification.js
const Notification = require('../models/Notification'); // Adjust path

/**
 * Creates and saves a notification document and emits real-time events.
 *
 * @param {string} userId - The ID of the user receiving the notification.
 * @param {string} type - The notification type (enum from Notification schema).
 * @param {string} message - The notification message content.
 * @param {object} options - Optional parameters.
 * @param {string} [options.link] - Optional link for frontend routing.
 * @param {string} [options.relatedBookingId] - Optional related Booking ID.
 * @param {string} [options.relatedUserId] - Optional related User ID.
 * @param {string} [options.relatedAthleteId] - Optional related Athlete ID.
 */
const createNotification = async (userId, type, message, options = {}) => {
    if (!userId || !type || !message) {
        console.error('Notification Error: Missing required fields (userId, type, message)', { userId, type, message });
        return;
    }

    try {
        const notificationData = {
            user: userId,
            type: type,
            message: message,
            link: options.link,
            relatedBooking: options.relatedBookingId,
            relatedUser: options.relatedUserId,
            relatedAthlete: options.relatedAthleteId,
            isRead: false // Always start as unread
        };

        const notification = new Notification(notificationData);
        const savedNotification = await notification.save(); // Save and get the saved doc
        console.log(`Notification created for user ${userId} (Type: ${type}) ID: ${savedNotification._id}`);

        // --- Emit Real-time Events ---
        try {
            // Get the io instance (ensure server.js has run and exported it)
            // This assumes server.js is the main entry point and exports `io`
            const { io } = require('../server'); // Adjust path relative to createNotification.js

            if (io) {
                const userRoom = userId.toString(); // Emit to the user's room

                // 1. Emit the new notification itself
                io.to(userRoom).emit('new_notification', savedNotification.toObject()); // Send the full notification data
                console.log(`[Socket.IO] Emitted 'new_notification' to room ${userRoom}`);

                // 2. Emit the updated unread count
                const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });
                io.to(userRoom).emit('unread_count_update', { count: unreadCount });
                console.log(`[Socket.IO] Emitted 'unread_count_update' (${unreadCount}) to room ${userRoom}`);

            } else {
                console.warn('[createNotification] Socket.IO instance (io) not available for emitting.');
            }
        } catch (socketError) {
            console.error(`[createNotification] Error emitting Socket.IO event for user ${userId}:`, socketError);
        }
        // --- End Emit Real-time Events ---

    } catch (error) {
        console.error(`Error creating notification DB entry for user ${userId} (Type: ${type}):`, error);
    }
};

module.exports = createNotification;
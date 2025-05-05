// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { // The user receiving the notification
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: { // Type of notification (e.g., booking confirmation, status update)
    type: String,
    required: true,
    enum: [
        'booking_created',
        'booking_status_update',
        'booking_reminder',
        'financial_aid_update',
        'donation_received', // For athlete
        'donation_thankyou', // For donor
        'weather_alert',
        'new_facility_nearby', // Example future enhancement
        'system_announcement',
        // Adding trainer application notification types
        'trainer_application_submitted',
        'trainer_application_approved',
        'trainer_application_rejected',
        'new_trainer_application', // For admin notifications
    ],
  },
  message: { // The main notification text
    type: String,
    required: true,
    trim: true,
  },
  link: { // Optional link for frontend navigation when clicked
    type: String, // e.g., /bookings/[booking_id], /profile/financial-aid
    trim: true,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  // Optional references for context
  relatedBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    sparse: true, // Allow null
  },
   relatedUser: { // e.g., admin who updated status, or donor
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true,
   },
   relatedAthlete: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'Athlete',
       sparse: true,
   }
   // Add other related refs like Facility, Trainer if useful
}, { timestamps: true }); // Adds createdAt and updatedAt

// Improve query performance for fetching user notifications
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });


module.exports = mongoose.model('Notification', notificationSchema);
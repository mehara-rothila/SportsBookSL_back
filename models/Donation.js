// models/Donation.js
const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  donorUser: { // User who made the donation
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // Or false if anonymous donations are allowed without login
  },
  athlete: { // Athlete receiving the donation
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Athlete',
    required: true,
    index: true,
  },
  amount: { // Donation amount in LKR
    type: Number,
    required: true,
  },
  donationDate: {
    type: Date,
    default: Date.now,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'succeeded', 'failed'],
    default: 'pending', // Update to 'succeeded' after payment confirmation
  },
  paymentGateway: { // e.g., 'stripe', 'payhere'
    type: String,
  },
  paymentIntentId: { // ID from the payment gateway
    type: String,
    index: true,
  },
  isAnonymous: { // If the donor chose to be anonymous
    type: Boolean,
    default: false,
  },
  message: { // Optional message from donor
      type: String,
      trim: true,
  }
}, { timestamps: true });

// Index for querying donations by user or athlete
donationSchema.index({ donorUser: 1 });
donationSchema.index({ athlete: 1, donationDate: -1 });

module.exports = mongoose.model('Donation', donationSchema);
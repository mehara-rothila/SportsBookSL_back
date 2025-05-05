// models/Booking.js
const mongoose = require('mongoose');
const shortid = require('shortid');

const equipmentRentalSchema = new mongoose.Schema({
  equipmentName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  pricePerItemPerHour: { type: Number, required: true }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // **** MODIFIED: Facility is now optional ****
  facility: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Facility',
    // required: false, // No longer strictly required if trainer is present
    index: true,
  },
  // **** ADDED: Trainer field ****
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trainer',
    // required: false, // Not strictly required if facility is present
    index: true,
  },
  // **** ADDED: Booking Type ****
  bookingType: {
    type: String,
    enum: ['facility', 'trainer'],
    required: true,
    default: 'facility', // Default, but should be set explicitly
    index: true,
  },
  bookingId: {
    type: String,
    required: true,
    unique: true,
    default: shortid.generate
  },
  date: {
    type: Date,
    required: true,
  },
  timeSlot: { // e.g., "10:00-12:00" or "09:00-10:00"
    type: String,
    required: true,
  },
  durationHours: { // Calculated or stored based on timeSlot/request
    type: Number,
    required: true,
    // Default might vary, set explicitly in controller
  },
  participants: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  rentedEquipment: [equipmentRentalSchema], // Usually for facility bookings
  needsTransportation: {
    type: Boolean,
    default: false,
  },
  specialRequests: {
    type: String,
    trim: true,
  },
  facilityCost: { // Cost for the facility itself
    type: Number,
    default: 0, // Default to 0 for trainer-only bookings
  },
  equipmentCost: {
    type: Number,
    default: 0,
  },
  transportationCost: {
    type: Number,
    default: 0,
  },
  // **** ADDED: Trainer Cost ****
  trainerCost: {
    type: Number,
    default: 0, // Default to 0 for facility-only bookings
  },
  totalCost: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true,
  },
  status: {
    type: String,
    enum: ['upcoming', 'completed', 'cancelled', 'no-show'],
    default: 'upcoming',
    index: true,
  },
}, { timestamps: true });

// Add index for common queries
bookingSchema.index({ date: 1, timeSlot: 1, facility: 1 });
bookingSchema.index({ date: 1, timeSlot: 1, trainer: 1 }); // Index for trainer availability
bookingSchema.index({ user: 1, date: -1 });

// Ensure at least one of facility or trainer is provided
bookingSchema.pre('validate', function(next) {
  if (!this.facility && !this.trainer) {
    next(new Error('Booking must be associated with either a facility or a trainer.'));
  } else {
    next();
  }
});


module.exports = mongoose.model('Booking', bookingSchema);
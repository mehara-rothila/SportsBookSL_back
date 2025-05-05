// models/Facility.js
const mongoose = require('mongoose');
const Trainer = require('./Trainer'); // Import Trainer for populate
const Review = require('./Review'); // Import Review for populate

const facilitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    // Consider adding unique index if names must be unique
    // unique: true,
  },
  location: {
    type: String,
    required: true,
    index: true, // Add index for location filtering
  },
  address: { // Added address field
    type: String,
    required: true,
  },
  description: { // Added description
    type: String,
    required: true,
  },
  longDescription: { // Added long description
    type: String,
  },
  sportTypes: [{
    type: String,
    required: true,
    index: true, // Add index for sport filtering
  }],
  amenities: { // Added amenities
    type: [String],
  },
  pricePerHour: { // Keep the display string
     type: String,
     required: true,
  },
  pricePerHourValue: { // ADD THIS: Numeric value for filtering/sorting
    type: Number,
    required: true,
    index: true,
  },
  pricePerDay: { // Added optional daily price
    type: Number,
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
  reviewCount: {
    type: Number,
    default: 0,
  },
  contactInfo: { // Added contact info object
    phone: String,
    email: String,
    website: String,
  },
  images: { // Added images array
    type: [String], // Array of image URLs
    required: true,
  },
  operatingHours: [{ // Added operating hours
    day: { type: String, required: true }, // e.g., 'Monday'
    open: { type: String, required: true }, // e.g., '08:00'
    close: { type: String, required: true }, // e.g., '20:00'
    _id: false // Don't add _id to subdocuments
  }],
  equipmentForRent: [{ // Added equipment details (embedded)
    name: { type: String, required: true },
    pricePerHour: { type: Number, required: true },
    available: { type: Number, default: 0 },
    _id: false
  }],
  associatedCoaches: [{ // Added reference to Trainers
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trainer',
  }],
  mapLocation: { // Added map location
    lat: Number,
    lng: Number,
  },
  isNew: {
    type: Boolean,
    default: false,
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true,
  },
  // Optional: Reference to the owner user
  // owner: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'User',
  // }
}, {
    timestamps: true,
    toJSON: { virtuals: true }, // Ensure virtuals are included
    toObject: { virtuals: true }
});

// Virtual populate for reviews
facilitySchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'facility',
  justOne: false
});

// Text index for searching name, description, location, address
facilitySchema.index({ name: 'text', description: 'text', location: 'text', address: 'text' });

module.exports = mongoose.model('Facility', facilitySchema);
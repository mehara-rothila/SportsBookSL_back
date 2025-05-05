// models/Trainer.js
const mongoose = require('mongoose');

const trainerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  specialization: {
    type: String,
    required: true,
  },
  sports: { // Sports they coach
    type: [String], // Array of strings
    required: true,
  },
  location: { // Primary location
    type: String,
    required: true,
  },
  profileImage: {
    type: String, // URL
    default: '/images/default-trainer.png',
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  reviewCount: {
    type: Number,
    default: 0,
  },
  hourlyRate: {
    type: Number,
    required: true,
  },
  experienceYears: {
    type: Number,
    required: true,
    min: 0,
  },
  availability: { // Days they are generally available
    type: [String], // e.g., ['Monday', 'Wednesday', 'Friday']
  },
  // Could add more complex availability schema later (specific times, exceptions)
  certifications: {
    type: [String],
  },
  bio: {
    type: String,
    required: true,
  },
  languages: {
    type: [String],
  },
  associatedFacilities: [{ // Facilities they often coach at
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Facility',
  }],
  userAccount: { // Link to a User account if trainers can log in
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true, // Each trainer should link to max one user account
    sparse: true, // Allow null values if trainer doesn't have login
  },
  isActive: { // To control visibility on the platform
      type: Boolean,
      default: true,
  }
}, { timestamps: true });

// --- Indexes (Corrected) ---
// Index for filtering by sport (multi-key index on array elements)
trainerSchema.index({ sports: 1 });
// Index for filtering by location
trainerSchema.index({ location: 1 });
// Text index for searching name, specialization, bio
trainerSchema.index({ name: 'text', specialization: 'text', bio: 'text' });
// Optional: Compound index if you often query location AND sport together
// trainerSchema.index({ location: 1, sports: 1 });

module.exports = mongoose.model('Trainer', trainerSchema);
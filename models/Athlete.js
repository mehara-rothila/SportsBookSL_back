// models/Athlete.js
const mongoose = require('mongoose');

const athleteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  age: {
    type: Number,
    required: true,
  },
  sport: {
    type: String, // Or ref to Sport model
    required: true,
    index: true,
  },
  goalAmount: { // Target donation amount in LKR
    type: Number,
    required: true,
  },
  raisedAmount: {
    type: Number,
    default: 0,
  },
  image: { // URL to athlete's photo
    type: String,
    required: true,
  },
  achievements: {
    type: [String],
  },
  story: { // Athlete's background and need
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
    index: true,
  },
  isActive: { // Whether the donation campaign is active
    type: Boolean,
    default: true,
    index: true,
  },
  isFeatured: { // To feature specific athletes
      type: Boolean,
      default: false,
  },
  // Optional: Link to a User account if the athlete manages their profile
  // associatedUser: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'User',
  //   unique: true,
  //   sparse: true,
  // },
  // Optional: Store specific needs (e.g., equipment, facility fees)
  // needsBreakdown: [{ item: String, cost: Number }],
}, { timestamps: true });

// Virtual property for donation progress
athleteSchema.virtual('progress').get(function() {
  if (this.goalAmount > 0) {
    return Math.min(Math.round((this.raisedAmount / this.goalAmount) * 100), 100);
  }
  return 0;
});

// Ensure virtuals are included when converting to JSON
athleteSchema.set('toJSON', { virtuals: true });
athleteSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Athlete', athleteSchema);
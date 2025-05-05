// models/TrainerApplication.js
const mongoose = require('mongoose');

const trainerApplicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  specialization: {
    type: String,
    required: true
  },
  sports: {
    type: [String],
    required: true
  },
  location: {
    type: String,
    required: true
  },
  profileImage: {
    type: String,
    default: '/images/default-trainer.png'
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  experienceYears: {
    type: Number,
    required: true,
    min: 0
  },
  bio: {
    type: String,
    required: true
  },
  languages: {
    type: [String]
  },
  availability: {
    type: [String]
  },
  certifications: {
    type: [String]
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNotes: {
    type: String
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedDate: {
    type: Date
  },
  createdTrainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trainer'
  }
}, { timestamps: true });

// Indexes
trainerApplicationSchema.index({ userId: 1 });
trainerApplicationSchema.index({ status: 1 });
trainerApplicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TrainerApplication', trainerApplicationSchema);
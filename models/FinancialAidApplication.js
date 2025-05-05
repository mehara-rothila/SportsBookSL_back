// models/FinancialAidApplication.js
const mongoose = require('mongoose');

const financialAidApplicationSchema = new mongoose.Schema({
  applicantUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // Store submitted info directly or reference User profile at time of submission
  personalInfoSnapshot: {
    fullName: String,
    email: String,
    phone: String,
    dateOfBirth: Date,
    address: String,
    city: String,
    postalCode: String,
  },
  sportsInfo: {
    primarySport: String, // Store name or slug
    skillLevel: String, // Store name or id
    yearsExperience: Number,
    currentAffiliation: String,
    achievements: String,
  },
  financialNeed: {
    description: String,
    requestedAmount: Number,
    facilitiesNeeded: [String], // Store facility type names/ids
    monthlyUsage: String, // Store selected frequency string
  },
  reference: {
    name: String,
    relationship: String,
    contactInfo: String,
    organizationName: String,
  },
  documentUrls: { // URLs to uploaded documents (e.g., on S3)
    type: [String],
  },
  supportingInfo: {
    previousAid: String,
    otherPrograms: String,
    additionalInfo: String,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'needs_info'],
    default: 'pending',
    index: true,
  },
  submittedDate: {
    type: Date,
    default: Date.now,
  },
  reviewedDate: {
    type: Date,
  },
  approvedAmount: { // Amount actually approved by admin
    type: Number,
  },
  validUntil: { // Expiry date for the approved aid
    type: Date,
  },
  adminNotes: { // Notes from the admin reviewing the application
    type: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('FinancialAidApplication', financialAidApplicationSchema);
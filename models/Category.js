const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  imageSrc: { // URL to the image
    type: String,
    required: true,
  },
  iconSvg: { // Store the SVG string or a reference
    type: String,
  },
  slug: { // For URL linking, e.g., 'cricket'
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  // Add other fields as needed
}, { timestamps: true }); // Adds createdAt and updatedAt

module.exports = mongoose.model('Category', categorySchema);
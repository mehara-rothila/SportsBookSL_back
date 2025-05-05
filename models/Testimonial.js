const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  author: {
    type: String,
    required: true,
  },
  role: {
    type: String,
  },
  imageUrl: { // URL to the author's image
    type: String,
  },
  isActive: { // To control which testimonials are shown
    type: Boolean,
    default: true,
  },
  // Add rating if applicable
}, { timestamps: true });

module.exports = mongoose.model('Testimonial', testimonialSchema);
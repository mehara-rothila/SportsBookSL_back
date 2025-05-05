// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Review can be for a Facility OR a Trainer
  facility: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Facility',
    // Required only if trainer is not set
    required: function() { return !this.trainer; },
    index: true,
  },
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trainer',
    // Required only if facility is not set
    required: function() { return !this.facility; },
    index: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  reviewDate: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Prevent user from submitting more than one review per facility/trainer
reviewSchema.index({ user: 1, facility: 1 }, { unique: true, sparse: true }); // Sparse allows null facility
reviewSchema.index({ user: 1, trainer: 1 }, { unique: true, sparse: true }); // Sparse allows null trainer

// --- Static method to calculate average rating ---
// This needs to be called after saving or removing a review
reviewSchema.statics.calculateAverageRating = async function(targetId, targetModel) {
  const obj = await this.aggregate([
    { $match: { [targetModel]: targetId } }, // Match reviews for the specific facility or trainer
    {
      $group: {
        _id: `$${targetModel}`,
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  try {
    const Model = mongoose.model(targetModel === 'facility' ? 'Facility' : 'Trainer');
    if (obj.length > 0) {
      await Model.findByIdAndUpdate(targetId, {
        rating: obj[0].averageRating.toFixed(1), // Round to one decimal place
        reviewCount: obj[0].reviewCount
      });
    } else {
      // No reviews left, reset rating and count
      await Model.findByIdAndUpdate(targetId, {
        rating: 0,
        reviewCount: 0
      });
    }
  } catch (err) {
    console.error(`Error updating average rating for ${targetModel} ${targetId}:`, err);
  }
};

// Call calculateAverageRating after saving a review
reviewSchema.post('save', function() {
  const targetModel = this.facility ? 'facility' : 'trainer';
  const targetId = this.facility || this.trainer;
  this.constructor.calculateAverageRating(targetId, targetModel);
});

// Call calculateAverageRating before removing a review (using findOneAndDelete/remove middleware)
// Note: Need to handle different remove methods if used (e.g., deleteMany)
reviewSchema.pre('remove', function(next) {
  // Store the target info before the document is removed
  this._targetModel = this.facility ? 'facility' : 'trainer';
  this._targetId = this.facility || this.trainer;
  next();
});

reviewSchema.post('remove', function() {
  // Use the stored info to update the rating
  if (this._targetId && this._targetModel) {
    this.constructor.calculateAverageRating(this._targetId, this._targetModel);
  }
});


module.exports = mongoose.model('Review', reviewSchema);
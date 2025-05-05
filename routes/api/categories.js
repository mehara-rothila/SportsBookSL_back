// routes/api/categories.js
const express = require('express');
const router = express.Router();
const {
    getCategories,
    getCategoryByIdOrSlug, // Import new controller
    createCategory,
    updateCategory,      // Import new controller
    deleteCategory       // Import new controller
} = require('../../controllers/categoryController'); // Adjust path if needed
const { uploadCategoryImage } = require('../../middleware/uploadMiddleware'); // Adjust path if needed
const { protect, admin } = require('../../middleware/authMiddleware'); // Adjust path if needed

// Public routes
router.route('/').get(getCategories);
router.route('/:idOrSlug').get(getCategoryByIdOrSlug); // Public GET for single category

// Admin Routes (Protected)
router.route('/')
    // Apply protect and admin middleware before multer and controller
    .post(protect, admin, uploadCategoryImage, createCategory);

router.route('/:id')
    // Apply protect and admin middleware before multer and controller for PUT
    .put(protect, admin, uploadCategoryImage, updateCategory)
    // Apply protect and admin middleware before controller for DELETE
    .delete(protect, admin, deleteCategory);

module.exports = router;
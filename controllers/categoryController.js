// controllers/categoryController.js
const Category = require('../models/Category');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const fs = require('fs'); // Require fs for file deletion
const path = require('path'); // Require path

// @desc    Get all sport categories
// @route   GET /api/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  console.log("[getCategories] Fetching all categories");
  const categories = await Category.find({});
  res.status(200).json(categories);
});

// @desc    Get single category by ID or Slug
// @route   GET /api/categories/:idOrSlug
// @access  Public
const getCategoryByIdOrSlug = asyncHandler(async (req, res) => {
    const idOrSlug = req.params.idOrSlug;
    let category;
    console.log(`[getCategoryByIdOrSlug] Finding category by: ${idOrSlug}`);

    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
        category = await Category.findById(idOrSlug);
        console.log(`[getCategoryByIdOrSlug] Found by ID: ${category ? category.name : 'Not Found'}`);
    }

    if (!category) {
        // Try finding by slug if not found by ID or if param wasn't a valid ID
        category = await Category.findOne({ slug: idOrSlug.toLowerCase() });
         console.log(`[getCategoryByIdOrSlug] Found by Slug: ${category ? category.name : 'Not Found'}`);
    }

    if (category) {
        res.json(category);
    } else {
        res.status(404);
        throw new Error('Category not found');
    }
});


// @desc    Create a new sport category
// @route   POST /api/categories
// @access  Private/Admin
const createCategory = asyncHandler(async (req, res) => {
  console.log("[createCategory] Attempting to create category");
  console.log("[createCategory] Body:", req.body);
  console.log("[createCategory] File:", req.file);

  if (req.fileValidationError) {
      res.status(400); throw new Error(req.fileValidationError);
  }
  if (!req.file) {
      res.status(400); throw new Error('Category image is required (field name: imageSrc)');
  }

  const { name, description, iconSvg, slug } = req.body;
  if (!name || !description || !slug) {
      res.status(400); throw new Error('Name, description, and slug are required');
  }

  const slugLower = slug.toLowerCase();
  const categoryExists = await Category.findOne({ slug: slugLower });
  if (categoryExists) {
    res.status(400);
    // Clean up uploaded file if validation fails
    fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting uploaded file on duplicate slug:", err); });
    throw new Error('Category with this slug already exists');
  }

  const imagePath = `/uploads/categories/${req.file.filename}`;

  const category = new Category({
    name, description, imageSrc: imagePath, iconSvg, slug: slugLower,
  });

  const createdCategory = await category.save();
  console.log("[createCategory] Category created successfully:", createdCategory._id);
  res.status(201).json(createdCategory);
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory = asyncHandler(async (req, res) => {
    const categoryId = req.params.id;
    console.log(`[updateCategory] Attempting update for ID: ${categoryId}`);
    console.log("[updateCategory] Body:", req.body);
    console.log("[updateCategory] File:", req.file); // Check if a new file was uploaded

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        res.status(400); throw new Error('Invalid Category ID format');
    }

    const category = await Category.findById(categoryId);
    if (!category) {
        res.status(404); throw new Error('Category not found');
    }

    // Check for Multer validation errors if a file was uploaded
    if (req.file && req.fileValidationError) {
        res.status(400); throw new Error(req.fileValidationError);
    }

    // Update fields from req.body
    category.name = req.body.name || category.name;
    category.description = req.body.description || category.description;
    category.iconSvg = req.body.iconSvg !== undefined ? req.body.iconSvg : category.iconSvg; // Allow clearing SVG

    // Handle potential slug update (check for uniqueness if changed)
    if (req.body.slug && req.body.slug.toLowerCase() !== category.slug) {
        const newSlugLower = req.body.slug.toLowerCase();
        const existingCategory = await Category.findOne({ slug: newSlugLower });
        if (existingCategory) {
             res.status(400);
             // If a new file was uploaded during this failed update, delete it
             if (req.file) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting temp upload on slug conflict:", err); });
             throw new Error('Another category with this slug already exists.');
        }
        category.slug = newSlugLower;
    }

    // Handle image update
    let oldImagePath = null;
    if (req.file) {
        oldImagePath = category.imageSrc; // Store old path for deletion after save
        category.imageSrc = `/uploads/categories/${req.file.filename}`; // Set new path
        console.log(`[updateCategory] New image path set: ${category.imageSrc}`);
    }

    const updatedCategory = await category.save();

    // Delete old image file *after* successful save
    if (oldImagePath) {
        const fullOldPath = path.resolve(__dirname, '..', 'public', oldImagePath);
        console.log(`[updateCategory] Attempting to delete old image: ${fullOldPath}`);
        fs.unlink(fullOldPath, (err) => {
            if (err && err.code !== 'ENOENT') console.error(`Error deleting old category image ${fullOldPath}:`, err);
            else if (!err) console.log(`[updateCategory] Successfully deleted old image: ${fullOldPath}`);
        });
    }

    console.log(`[updateCategory] Category ${categoryId} updated successfully.`);
    res.status(200).json(updatedCategory);
});

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory = asyncHandler(async (req, res) => {
    const categoryId = req.params.id;
     console.log(`[deleteCategory] Attempting delete for ID: ${categoryId}`);

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        res.status(400); throw new Error('Invalid Category ID format');
    }

    const category = await Category.findById(categoryId);

    if (!category) {
        res.status(404); throw new Error('Category not found');
    }

    const imagePath = category.imageSrc;

    // Use findByIdAndDelete to trigger potential middleware if needed later
    await Category.findByIdAndDelete(categoryId);

    // Delete associated image file
    if (imagePath) {
         const fullImagePath = path.resolve(__dirname, '..', 'public', imagePath);
         console.log(`[deleteCategory] Attempting to delete image: ${fullImagePath}`);
         fs.unlink(fullImagePath, (err) => {
            if (err && err.code !== 'ENOENT') console.error(`Error deleting category image ${fullImagePath}:`, err);
            else if (!err) console.log(`[deleteCategory] Successfully deleted image: ${fullImagePath}`);
         });
    }

    // TODO: Consider implications - what happens to Facilities/Trainers using this category?
    // Maybe prevent deletion if in use, or set their category field to null?

    console.log(`[deleteCategory] Category ${categoryId} deleted successfully.`);
    res.status(200).json({ message: 'Category deleted successfully' });
});


// --- Export the functions ---
module.exports = {
  getCategories,
  getCategoryByIdOrSlug, // Export new function
  createCategory,
  updateCategory,      // Export new function
  deleteCategory,      // Export new function
};
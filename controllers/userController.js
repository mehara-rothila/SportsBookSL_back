// controllers/userController.js
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Facility = require('../models/Facility');
const Booking = require('../models/Booking');
const FinancialAidApplication = require('../models/FinancialAidApplication');
const Donation = require('../models/Donation');
const fs = require('fs');
const path = require('path');

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    console.log('[User Profile] Returning profile for user:', user._id);
    
    res.status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
        sportPreferences: user.sportPreferences,
        createdAt: user.createdAt,
        role: user.role,
    });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    // Fields that can be updated
    const { name, email, phone, address, sportPreferences } = req.body;
    
    console.log('[User Profile Update] Updating user profile with data:', {
        name: name || '[unchanged]',
        email: email || '[unchanged]',
        phone: phone !== undefined ? phone : '[unchanged]',
        address: address !== undefined ? address : '[unchanged]',
        sportPreferences: sportPreferences ? 'Updated preferences' : '[unchanged]'
    });
    
    // Update fields if provided
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (sportPreferences) user.sportPreferences = sportPreferences;
    
    const updatedUser = await user.save();
    console.log('[User Profile Update] User profile updated successfully for ID:', updatedUser._id);
    
    res.status(200).json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        address: updatedUser.address,
        avatar: updatedUser.avatar,
        sportPreferences: updatedUser.sportPreferences,
        createdAt: updatedUser.createdAt,
        role: updatedUser.role,
    });
});

/**
 * @desc    Update user avatar
 * @route   PUT /api/users/profile/avatar
 * @access  Private
 */
const updateUserAvatar = asyncHandler(async (req, res) => {
    // Check if file was uploaded successfully
    if (!req.file) {
        console.error('[Avatar Update] No file received in request');
        res.status(400);
        throw new Error('No file uploaded');
    }
    
    console.log('[Avatar Update] File uploaded:', {
        originalname: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        mimetype: req.file.mimetype,
        size: `${(req.file.size / 1024).toFixed(2)} KB`
    });
    
    // Find user by ID (from auth middleware)
    const user = await User.findById(req.user._id);
    
    if (!user) {
        // Clean up the uploaded file since the user wasn't found
        try {
            fs.unlinkSync(req.file.path);
            console.log(`[Avatar Update] Deleted uploaded file ${req.file.path} because user not found`);
        } catch (unlinkErr) {
            console.error('[Avatar Update] Error deleting uploaded file:', unlinkErr);
        }
        
        res.status(404);
        throw new Error('User not found');
    }
    
    // Store the old avatar path for cleanup
    const oldAvatarPath = user.avatar;
    
    // Set avatar path in the database (relative to public directory)
    // Make sure the path format is consistent
    const avatarUrlPath = `/uploads/avatars/${req.file.filename}`;
    console.log(`[Avatar Update] Setting avatar path in database to: ${avatarUrlPath}`);
    
    // Update user with new avatar path
    user.avatar = avatarUrlPath;
    const updatedUser = await user.save();
    
    // Delete old avatar file if it exists and is not the default
    if (oldAvatarPath && 
        oldAvatarPath !== '/images/default-avatar.png' && 
        !oldAvatarPath.includes('default')) {
        try {
            // Construct full path to the old avatar file
            const oldFilePath = path.join(__dirname, '..', 'public', oldAvatarPath);
            console.log(`[Avatar Update] Attempting to delete old avatar at: ${oldFilePath}`);
            
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
                console.log(`[Avatar Update] Successfully deleted old avatar: ${oldFilePath}`);
            } else {
                console.log(`[Avatar Update] Old avatar file not found at: ${oldFilePath}`);
            }
        } catch (err) {
            // Don't fail the response if we can't delete the old file
            console.error('[Avatar Update] Error deleting old avatar:', err);
        }
    }
    
    // Return updated user data
    res.status(200).json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        address: updatedUser.address,
        avatar: updatedUser.avatar, // Return the URL path
        sportPreferences: updatedUser.sportPreferences,
        createdAt: updatedUser.createdAt,
        role: updatedUser.role,
    });
});

/**
 * @desc    Remove user avatar
 * @route   DELETE /api/users/profile/avatar
 * @access  Private
 */
const removeUserAvatar = asyncHandler(async (req, res) => {
    // Find user by ID
    const user = await User.findById(req.user._id);
    
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    // Store the current avatar path
    const currentAvatarPath = user.avatar;
    console.log(`[Avatar Remove] Current avatar path: ${currentAvatarPath}`);
    
    // Delete avatar file if it exists and is not the default
    if (currentAvatarPath && 
        currentAvatarPath !== '/images/default-avatar.png' && 
        !currentAvatarPath.includes('default')) {
        try {
            // Construct full path to the avatar file
            const filePath = path.join(__dirname, '..', 'public', currentAvatarPath);
            console.log(`[Avatar Remove] Attempting to delete avatar at: ${filePath}`);
            
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[Avatar Remove] Successfully deleted avatar: ${filePath}`);
            } else {
                console.log(`[Avatar Remove] Avatar file not found at: ${filePath}`);
            }
        } catch (err) {
            // Log error but continue to update the user record
            console.error('[Avatar Remove] Error deleting avatar file:', err);
        }
    }
    
    // Set avatar to null or default value
    user.avatar = null; // or use '/images/default-avatar.png' if you want a default
    const updatedUser = await user.save();
    
    console.log(`[Avatar Remove] Updated user avatar to: ${updatedUser.avatar}`);
    
    // Return updated user data
    res.status(200).json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        address: updatedUser.address,
        avatar: updatedUser.avatar,
        sportPreferences: updatedUser.sportPreferences,
        createdAt: updatedUser.createdAt,
        role: updatedUser.role,
    });
});

/**
 * @desc    Get user bookings
 * @route   GET /api/users/bookings
 * @access  Private
 */
const getUserBookings = asyncHandler(async (req, res) => {
    console.log('[User Bookings] Fetching bookings for user:', req.user._id);
    
    const bookings = await Booking.find({ user: req.user._id })
        .populate('facility', 'name location images')
        .populate('trainer', 'name specialization avatar')
        .sort({ date: -1 });
    
    console.log(`[User Bookings] Found ${bookings.length} bookings for user:`, req.user._id);
    res.status(200).json(bookings);
});

/**
 * @desc    Get user favorites
 * @route   GET /api/users/favorites
 * @access  Private
 */
const getUserFavorites = asyncHandler(async (req, res) => {
    console.log('[User Favorites] Fetching favorites for user:', req.user._id);
    
    const user = await User.findById(req.user._id).populate('favorites');
    
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    console.log(`[User Favorites] Found ${user.favorites?.length || 0} favorites for user:`, req.user._id);
    res.status(200).json(user.favorites || []);
});

/**
 * @desc    Add a facility to favorites
 * @route   POST /api/users/favorites
 * @access  Private
 */
const addFavorite = asyncHandler(async (req, res) => {
    const { facilityId } = req.body;
    
    if (!facilityId) {
        res.status(400);
        throw new Error('Facility ID is required');
    }
    
    console.log(`[Add Favorite] Adding facility ${facilityId} to favorites for user:`, req.user._id);
    
    // Check if facility exists
    const facility = await Facility.findById(facilityId);
    if (!facility) {
        res.status(404);
        throw new Error('Facility not found');
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    // Check if already in favorites
    if (user.favorites.includes(facilityId)) {
        res.status(400);
        throw new Error('Facility already in favorites');
    }
    
    // Add to favorites
    user.favorites.push(facilityId);
    await user.save();
    
    // Get updated favorites with populated data
    const updatedUser = await User.findById(req.user._id).populate('favorites');
    
    console.log(`[Add Favorite] Successfully added facility ${facilityId} to favorites for user:`, req.user._id);
    res.status(200).json(updatedUser.favorites);
});

/**
 * @desc    Remove a facility from favorites
 * @route   DELETE /api/users/favorites/:facilityId
 * @access  Private
 */
const removeFavorite = asyncHandler(async (req, res) => {
    const { facilityId } = req.params;
    
    if (!facilityId) {
        res.status(400);
        throw new Error('Facility ID is required');
    }
    
    console.log(`[Remove Favorite] Removing facility ${facilityId} from favorites for user:`, req.user._id);
    
    const user = await User.findById(req.user._id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    // Check if the facility is in favorites
    if (!user.favorites.includes(facilityId)) {
        res.status(400);
        throw new Error('Facility not in favorites');
    }
    
    // Remove from favorites
    user.favorites = user.favorites.filter(
        (favId) => favId.toString() !== facilityId
    );
    await user.save();
    
    // Get updated favorites with populated data
    const updatedUser = await User.findById(req.user._id).populate('favorites');
    
    console.log(`[Remove Favorite] Successfully removed facility ${facilityId} from favorites for user:`, req.user._id);
    res.status(200).json(updatedUser.favorites);
});

/**
 * @desc    Get user financial aid applications
 * @route   GET /api/users/financial-aid
 * @access  Private
 */
const getUserFinancialAidApps = asyncHandler(async (req, res) => {
    console.log('[User Financial Aid] Fetching applications for user:', req.user._id);
    
    // FIXED: Changed 'user' to 'applicantUser' to match the model field name
    const applications = await FinancialAidApplication.find({ applicantUser: req.user._id })
        .sort({ createdAt: -1 });
    
    console.log(`[User Financial Aid] Found ${applications.length} applications for user:`, req.user._id);
    res.status(200).json(applications);
});

/**
 * @desc    Get user donation history
 * @route   GET /api/users/donations/history
 * @access  Private
 */
const getUserDonationHistory = asyncHandler(async (req, res) => {
    console.log('[User Donations] Fetching donation history for user:', req.user._id);
    
    // FIXED: Changed 'donor' to 'donorUser' to match the model field name
    const donations = await Donation.find({ donorUser: req.user._id })
        .populate('athlete', 'name')
        .sort({ donationDate: -1 });
    
    console.log(`[User Donations] Found ${donations.length} donations for user:`, req.user._id);
    res.status(200).json(donations);
});

// ============= ADMIN FUNCTIONS =============

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
const getAllAdminUsers = asyncHandler(async (req, res) => {
    console.log('[Admin] Fetching all users');
    
    const users = await User.find({})
        .select('-password')
        .sort({ createdAt: -1 });
    
    console.log(`[Admin] Found ${users.length} users`);
    res.status(200).json({ users });
});

/**
 * @desc    Update user by admin
 * @route   PUT /api/admin/users/:id
 * @access  Private/Admin
 */
const updateUserByAdmin = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    
    if (!userId) {
        res.status(400);
        throw new Error('User ID is required');
    }
    
    console.log(`[Admin] Updating user ${userId} with data:`, req.body);
    
    const user = await User.findById(userId);
    
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    // Fields that can be updated by admin
    const { name, email, phone, address, role } = req.body;
    
    // Update fields if provided
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (role) user.role = role;
    
    const updatedUser = await user.save();
    console.log(`[Admin] Successfully updated user ${userId}`);
    
    res.status(200).json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        address: updatedUser.address,
        avatar: updatedUser.avatar,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt,
    });
});

/**
 * @desc    Delete user by admin
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 */
const deleteUserByAdmin = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    
    if (!userId) {
        res.status(400);
        throw new Error('User ID is required');
    }
    
    console.log(`[Admin] Deleting user ${userId}`);
    
    const user = await User.findById(userId);
    
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    // Delete user's avatar if exists
    if (user.avatar && 
        user.avatar !== '/images/default-avatar.png' && 
        !user.avatar.includes('default')) {
        try {
            const avatarPath = path.join(__dirname, '..', 'public', user.avatar);
            if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
                console.log(`[Admin] Deleted avatar for user ${userId}: ${avatarPath}`);
            }
        } catch (err) {
            console.error(`[Admin] Error deleting avatar for user ${userId}:`, err);
            // Continue with user deletion even if avatar deletion fails
        }
    }
    
    // Delete the user
    await User.deleteOne({ _id: userId });
    console.log(`[Admin] Successfully deleted user ${userId}`);
    
    res.status(200).json({ message: 'User deleted successfully' });
});

module.exports = {
    getUserProfile,
    updateUserProfile,
    updateUserAvatar,
    removeUserAvatar,
    getUserBookings,
    getUserFavorites,
    addFavorite,
    removeFavorite,
    getUserFinancialAidApps,
    getUserDonationHistory,
    // Admin functions
    getAllAdminUsers,
    updateUserByAdmin,
    deleteUserByAdmin
};
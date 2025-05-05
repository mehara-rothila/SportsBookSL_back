// controllers/utilityController.js
const asyncHandler = require('express-async-handler');
const Facility = require('../models/Facility');
const Trainer = require('../models/Trainer');
const Category = require('../models/Category'); // Assuming Category model exists for sports list

// @desc    Get distinct list of sports from facilities/trainers/categories
// @route   GET /api/utils/sports
// @access  Public
const getSportsList = asyncHandler(async (req, res) => {
    try {
        // Option 1: From Categories model (if exists and maintained)
        const categorySports = await Category.find({ isActive: { $ne: false } }).select('name');
        const categoryNames = categorySports.map(c => c.name);

        // Option 2: Distinct from Facilities and Trainers
        const facilitySports = await Facility.distinct('sportTypes');
        const trainerSports = await Trainer.distinct('sports');
        
        // Combine all sources and get unique values
        const allSports = [...new Set([...categoryNames, ...facilitySports, ...trainerSports])];
        
        // Sort alphabetically
        allSports.sort();
        
        res.json(allSports);
    } catch (error) {
        console.error('Error fetching sports list:', error);
        res.status(500);
        throw new Error('Error retrieving sports list');
    }
});

// @desc    Get distinct list of locations from facilities/trainers
// @route   GET /api/utils/locations
// @access  Public
const getLocationsList = asyncHandler(async (req, res) => {
    try {
        const facilityLocations = await Facility.distinct('location');
        const trainerLocations = await Trainer.distinct('location');
        
        // Combine and deduplicate
        const allLocations = [...new Set([...facilityLocations, ...trainerLocations])];
        
        // Sort alphabetically
        allLocations.sort();
        
        res.json(allLocations);
    } catch (error) {
        console.error('Error fetching locations list:', error);
        res.status(500);
        throw new Error('Error retrieving locations list');
    }
});

// @desc    Get list of all facility types (previously commented out, now implemented)
// @route   GET /api/utils/facility-types
// @access  Public
const getFacilityTypes = asyncHandler(async (req, res) => {
    try {
        // This depends on your data model
        // If facility types are stored in a separate field, use distinct:
        const facilityTypes = await Facility.distinct('facilityType');
        
        // If not in the database, you could return predefined types
        if (!facilityTypes || facilityTypes.length === 0) {
            return res.json([
                'Stadium', 
                'Indoor Court', 
                'Swimming Pool', 
                'Gym', 
                'Tennis Court', 
                'Cricket Ground',
                'Outdoor Field',
                'Golf Course'
            ]);
        }
        
        // Sort alphabetically
        facilityTypes.sort();
        
        res.json(facilityTypes);
    } catch (error) {
        console.error('Error fetching facility types:', error);
        res.status(500);
        throw new Error('Error retrieving facility types');
    }
});

// @desc    Get list of all skill levels (previously commented out, now implemented)
// @route   GET /api/utils/skill-levels
// @access  Public
const getSkillLevels = asyncHandler(async (req, res) => {
    // Skill levels are likely predefined since they're standardized
    const skillLevels = [
        'Beginner',
        'Intermediate',
        'Advanced',
        'Professional'
    ];
    
    res.json(skillLevels);
});

// @desc    Get app-wide statistics (new endpoint)
// @route   GET /api/utils/stats
// @access  Public
const getAppStats = asyncHandler(async (req, res) => {
    try {
        // Count total trainers
        const trainerCount = await Trainer.countDocuments({ isActive: { $ne: false } });
        
        // Count total facilities
        const facilityCount = await Facility.countDocuments({ isActive: { $ne: false } });
        
        // Count total categories
        const categoryCount = await Category.countDocuments({ isActive: { $ne: false } });
        
        // Get average trainer rating
        const ratingResult = await Trainer.aggregate([
            { $match: { isActive: { $ne: false }, rating: { $gt: 0 } } },
            { $group: { 
                _id: null, 
                averageRating: { $avg: "$rating" } 
            }}
        ]);
        
        const averageRating = ratingResult.length > 0 
            ? Math.round(ratingResult[0].averageRating * 10) / 10 
            : 0;
        
        // Use the sports list endpoint to count unique sports
        const sportsList = await getSportsList(req, {
            json: (data) => data // Mock response object with json method
        }).catch(() => []);
        
        const sportCount = Array.isArray(sportsList) ? sportsList.length : 0;
        
        res.json({
            trainers: trainerCount,
            facilities: facilityCount,
            categories: categoryCount,
            sports: sportCount,
            averageRating
        });
    } catch (error) {
        console.error('Error fetching app stats:', error);
        res.status(500);
        throw new Error('Error retrieving application statistics');
    }
});

// Export all the utility controller methods
module.exports = {
    getSportsList,
    getLocationsList,
    getFacilityTypes, // Now implemented
    getSkillLevels,   // Now implemented
    getAppStats       // New method
};
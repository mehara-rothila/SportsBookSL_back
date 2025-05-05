// controllers/athleteController.js
const asyncHandler = require('express-async-handler');
const Athlete = require('../models/Athlete');
const mongoose = require('mongoose');

// @desc    Get athletes for donation page (with filtering/search/sort/pagination)
// @route   GET /api/athletes
// @access  Public
const getAthletes = asyncHandler(async (req, res) => {
    const pageSize = 12; // Or get from query: Number(req.query.limit) || 12;
    const page = Number(req.query.pageNumber) || 1;

    const query = { isActive: true }; // Start with active athletes

    // Keyword search (name, sport, location, story)
    if (req.query.keyword) {
        const keywordRegex = { $regex: req.query.keyword, $options: 'i' };
        query.$or = [
            { name: keywordRegex },
            { sport: keywordRegex },
            { location: keywordRegex },
            { story: keywordRegex }
        ];
    }

    // Filter by sport
    if (req.query.sport && req.query.sport !== 'all') {
        // Assuming sport query is lowercase ID from frontend
        query.sport = { $regex: `^${req.query.sport}$`, $options: 'i' };
    }

    // Filter by location
    if (req.query.location && req.query.location !== 'all') {
         // Assuming location query is lowercase ID from frontend
        query.location = { $regex: `^${req.query.location}$`, $options: 'i' };
    }

    // Sorting
    let sortOption = { createdAt: -1 }; // Default sort (newest first)
    if (req.query.sort) {
        switch (req.query.sort) {
            case '-goalAmount': // goal-high
                sortOption = { goalAmount: -1 };
                break;
            case 'goalAmount': // goal-low
                sortOption = { goalAmount: 1 };
                break;
            case '-progress': // Most progress (needs virtual or calculation)
                // Simple sort by raised amount descending as proxy for now
                // For true progress sort, you'd need aggregation pipeline
                sortOption = { raisedAmount: -1 };
                break;
            // Add other sort options if needed
        }
    }

    try {
        const count = await Athlete.countDocuments(query);
        const athletes = await Athlete.find(query)
            .sort(sortOption)
            .limit(pageSize)
            .skip(pageSize * (page - 1));

        res.status(200).json({
            athletes,
            page,
            pages: Math.ceil(count / pageSize),
            count
        });
    } catch (error) {
        console.error("Error fetching athletes:", error);
        res.status(500);
        throw new Error("Server error fetching athletes.");
    }
});

// @desc    Get single athlete details
// @route   GET /api/athletes/:id
// @access  Public
const getAthleteById = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        throw new Error('Invalid Athlete ID format');
    }
    // Use virtuals if needed when fetching single
    const athlete = await Athlete.findById(req.params.id);
    if (athlete) {
        res.status(200).json(athlete);
    } else {
        res.status(404);
        throw new Error('Athlete not found');
    }
});

// --- TODO: Add Admin functions (create, update, delete athlete profiles) ---

module.exports = {
    getAthletes,
    getAthleteById,
};
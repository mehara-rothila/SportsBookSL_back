// routes/api/athletes.js
const express = require('express');
const router = express.Router();
const {
    getAthletes,
    getAthleteById,
} = require('../../controllers/athleteController');

// **** ADD THIS LINE (Optional, as these are GET only, but good practice) ****
router.use(express.json()); // Apply JSON parser for this router

// Public routes for viewing athletes
router.route('/')
    .get(getAthletes); // GET /api/athletes?sport=...&location=...

router.route('/:id')
    .get(getAthleteById); // GET /api/athletes/<athlete_id>

// --- TODO: Add Admin routes for managing athletes (POST/PUT/DELETE would need JSON parser) ---

module.exports = router;
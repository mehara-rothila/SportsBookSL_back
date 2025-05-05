// routes/api/utils.js
const express = require('express');
const router = express.Router();
const {
    getSportsList,
    getLocationsList,
    getFacilityTypes, // Assuming this was uncommented in controller
    getSkillLevels,   // Assuming this was uncommented in controller
    getAppStats       // Assuming this was added in controller
} = require('../../controllers/utilityController');

// **** ADD THIS LINE (Optional, as these are GET only, but good practice) ****
router.use(express.json()); // Apply JSON parser for this router

// Public utility routes
router.get('/sports', getSportsList);
router.get('/locations', getLocationsList);
router.get('/facility-types', getFacilityTypes);
router.get('/skill-levels', getSkillLevels);
router.get('/stats', getAppStats); // Route for the new stats endpoint

module.exports = router;
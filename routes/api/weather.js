// routes/api/weather.js
const express = require('express');
const router = express.Router();
const { getWeather } = require('../../controllers/weatherController');

// **** ADD THIS LINE (Optional, as this is GET only, but good practice) ****
router.use(express.json()); // Apply JSON parser for this router

// Public route to get weather info
router.get('/', getWeather); // GET /api/weather?lat=...&lon=...

module.exports = router;
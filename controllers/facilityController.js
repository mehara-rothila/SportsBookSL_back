// controllers/facilityController.js
const Facility = require('../models/Facility');
const Review = require('../models/Review'); // Needed for populating reviews
const Trainer = require('../models/Trainer'); // Needed for populating coaches
const Booking = require('../models/Booking'); // Needed for availability check
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose'); // Needed for ObjectId validation

// @desc    Create a new facility
// @route   POST /api/facilities
// @access  Private/Admin (Assumed - Apply protect/admin middleware in routes)
const createFacility = asyncHandler(async (req, res) => {
    // Check for file validation errors from Multer filter
    if (req.fileValidationError) {
        res.status(400);
        throw new Error(req.fileValidationError);
    }

    // Multer puts uploaded files info in req.files for .array()
    if (!req.files || req.files.length === 0) {
        res.status(400);
        throw new Error('At least one facility image is required (field name: images)');
    }

    // Get text data from req.body
    const {
        name,
        location,
        address,
        description,
        longDescription,
        sportTypes, // Expecting comma-separated string or array? Adjust parsing if needed.
        amenities,  // Expecting comma-separated string or array? Adjust parsing if needed.
        pricePerHour, // Display string
        pricePerHourValue, // Numeric value
        pricePerDay,
        contactPhone,
        contactEmail,
        contactWebsite,
        operatingHours, // Expecting JSON stringified array? Parse if needed.
        equipmentForRent, // Expecting JSON stringified array? Parse if needed.
        associatedCoaches, // Expecting array of IDs?
        mapLat,
        mapLng,
        isNew,
        isPremium,
        isFeatured
     } = req.body;

    // --- Basic Validation ---
    if (!name || !location || !address || !description || !sportTypes || !pricePerHour || !pricePerHourValue) {
        res.status(400);
        throw new Error('Missing required fields: name, location, address, description, sportTypes, pricePerHour, pricePerHourValue');
    }

    // Construct the relative paths for storage
    const imagePaths = req.files.map(file => `/uploads/facilities/${file.filename}`);

    // --- Data Type Parsing/Handling (Example - Adjust based on how frontend sends data) ---
    let parsedSportTypes = sportTypes;
    if (typeof sportTypes === 'string') {
        parsedSportTypes = sportTypes.split(',').map(s => s.trim()).filter(s => s);
    }
    let parsedAmenities = amenities;
    if (typeof amenities === 'string') {
        parsedAmenities = amenities.split(',').map(a => a.trim()).filter(a => a);
    }
    let parsedOperatingHours = operatingHours;
    if (typeof operatingHours === 'string') {
        try { parsedOperatingHours = JSON.parse(operatingHours); } catch (e) { /* handle error */ }
    }
    let parsedEquipment = equipmentForRent;
     if (typeof equipmentForRent === 'string') {
        try { parsedEquipment = JSON.parse(equipmentForRent); } catch (e) { /* handle error */ }
    }
    // --- End Data Type Parsing ---


    // Create new facility instance
    const facility = new Facility({
        name,
        location,
        address,
        description,
        longDescription,
        sportTypes: parsedSportTypes,
        amenities: parsedAmenities,
        pricePerHour,
        pricePerHourValue: Number(pricePerHourValue), // Ensure it's a number
        pricePerDay: pricePerDay ? Number(pricePerDay) : undefined,
        contactInfo: {
            phone: contactPhone,
            email: contactEmail,
            website: contactWebsite,
        },
        images: imagePaths, // Store the array of server paths
        operatingHours: parsedOperatingHours,
        equipmentForRent: parsedEquipment,
        associatedCoaches, // Assuming it's already an array of IDs
        mapLocation: {
            lat: mapLat ? Number(mapLat) : undefined,
            lng: mapLng ? Number(mapLng) : undefined,
        },
        isNew: isNew === 'true' || isNew === true, // Handle boolean conversion from form data
        isPremium: isPremium === 'true' || isPremium === true,
        isFeatured: isFeatured === 'true' || isFeatured === true,
        // owner: req.user.id // If tracking owner via JWT
    });

    const createdFacility = await facility.save();
    res.status(201).json(createdFacility);
});


// @desc    Get facilities with filtering, searching, and pagination
// @route   GET /api/facilities
// @access  Public
const getFacilities = asyncHandler(async (req, res) => {
    const pageSize = 12; // Number of facilities per page
    const page = Number(req.query.pageNumber) || 1; // Current page number

    // Build query object based on request query parameters
    const query = {};

    // Keyword search (name, description, location) - Case-insensitive
    if (req.query.keyword) {
        const keyword = req.query.keyword;
        // Using text index if available (more efficient for full-text search)
        // query.$text = { $search: keyword };
        // Fallback to regex if text index isn't set up or for broader matching
         query.$or = [
             { name: { $regex: keyword, $options: 'i' } },
             { description: { $regex: keyword, $options: 'i' } },
             { location: { $regex: keyword, $options: 'i' } },
             { address: { $regex: keyword, $options: 'i' } },
             { sportTypes: { $regex: keyword, $options: 'i' } } // Search in sports too
         ];
    }

    // Filter by sport type (case-insensitive match in the array)
    if (req.query.sportType && req.query.sportType !== 'all') {
        // Create a case-insensitive regex for the sport type
        const sportRegex = new RegExp(`^${req.query.sportType}$`, 'i');
        query.sportTypes = { $regex: sportRegex };
    }

    // Filter by location (case-insensitive)
    if (req.query.location && req.query.location !== 'all') {
        query.location = { $regex: req.query.location, $options: 'i' };
    }

    // Filter by rating (greater than or equal to)
    if (req.query.rating && req.query.rating !== 'all') {
        const ratingNum = Number(req.query.rating);
        if (!isNaN(ratingNum) && ratingNum >= 0 && ratingNum <= 5) {
            query.rating = { $gte: ratingNum };
        }
    }

    // Filter by price range using pricePerHourValue
    if (req.query.priceRange && req.query.priceRange !== 'all') {
        const [minStr, maxStr] = req.query.priceRange.split('-');
        const min = Number(minStr);
        const max = maxStr ? Number(maxStr) : null; // Handle ranges like '5000-'

        if (!isNaN(min)) {
            if (max && !isNaN(max)) { // Range like 1000-2000
                query.pricePerHourValue = { $gte: min, $lte: max };
            } else if (max === null && min > 0) { // Range like 5000- (meaning 5000 and up)
                 query.pricePerHourValue = { $gte: min };
            } else if (max === null && min === 0) { // Range like 0- (meaning up to a certain value, needs max) - This case might need adjustment based on UI
                 // If range is '0-', maybe it means 'free' or 'up to max'? Let's assume it means >= 0 for now.
                 query.pricePerHourValue = { $gte: 0 };
            }
        }
    }


    // Filter by amenities (facility must have ALL specified amenities)
    if (req.query.amenities) {
        const amenitiesList = req.query.amenities.split(',').map(a => a.trim()).filter(a => a); // Trim whitespace and remove empty strings
        if (amenitiesList.length > 0) {
             // Case-insensitive match for each amenity in the array
            query.amenities = { $all: amenitiesList.map(a => new RegExp(`^${a}$`, 'i')) };
        }
    }

    // Count total matching documents for pagination
    const count = await Facility.countDocuments(query);

    // Find facilities matching the query, apply pagination and sorting
    // Select only fields needed for the list view to optimize
    // NOTE: 'image' field doesn't exist, it's 'images' (array)
    const facilities = await Facility.find(query)
        .select('name location sportTypes images rating reviewCount pricePerHour isPremium isNew pricePerHourValue address') // Select specific fields, including 'images'
        .limit(pageSize)
        .skip(pageSize * (page - 1))
        .sort({ isFeatured: -1, rating: -1, createdAt: -1 }); // Sort by featured, then rating, then newest

    res.json({
        facilities,
        page,
        pages: Math.ceil(count / pageSize), // Total number of pages
        count // Total number of matching facilities
    });
});


// @desc    Get featured facilities
// @route   GET /api/facilities/featured
// @access  Public
const getFeaturedFacilities = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 4; // Default to 4 for typical featured sections
  // NOTE: 'image' field doesn't exist, it's 'images' (array)
  const facilities = await Facility.find({ isFeatured: true })
    .select('name location sportTypes images rating reviewCount pricePerHour isPremium isNew pricePerHourValue address') // Select specific fields, including 'images'
    .limit(limit)
    .sort({ rating: -1, createdAt: -1 });
  res.json(facilities);
});


// @desc    Get single facility by ID with populated details
// @route   GET /api/facilities/:id
// @access  Public
const getFacilityById = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        throw new Error('Invalid Facility ID format');
    }

    // Fetch facility and populate associated data in parallel for efficiency
    const facilityPromise = Facility.findById(req.params.id)
        .populate({
            path: 'associatedCoaches', // Field name in Facility schema
            select: 'name specialization profileImage rating hourlyRate', // Select fields from Trainer
            model: Trainer // Explicitly specify model
        });
        // If equipment is referenced via ObjectId: .populate('equipmentForRent');

    // Fetch reviews separately with pagination (e.g., first 5 reviews)
    const reviewsPromise = Review.find({ facility: req.params.id })
        .populate('user', 'name avatar') // Populate user details for each review
        .sort({ reviewDate: -1 })
        .limit(5); // Limit initial review load

    // Execute promises concurrently
    const [facility, reviews] = await Promise.all([facilityPromise, reviewsPromise]);

    if (facility) {
        // Manually attach the fetched reviews to the facility object before sending
        // This is often more reliable than virtual populate across different scenarios
        const facilityObject = facility.toObject({ virtuals: true }); // Ensure virtuals are included if defined
        facilityObject.reviews = reviews; // Attach the separately fetched reviews

        res.json(facilityObject);
    } else {
        res.status(404);
        throw new Error('Facility not found');
    }
});

// @desc    Get availability for a facility for a given month/date range
// @route   GET /api/facilities/:id/availability?month=YYYY-MM
// @access  Public
const getFacilityAvailability = asyncHandler(async (req, res) => {
    // --- Basic Implementation ---
    // This is a simplified version. A real implementation would be more complex,
    // checking existing bookings against operating hours and potential buffer times.

    const facilityId = req.params.id; // Get facility ID from params
    console.log(`[Availability] Fetching availability for Facility ID: ${facilityId}`); // Log entry

    if (!mongoose.Types.ObjectId.isValid(facilityId)) { // Use facilityId here
        res.status(400);
        throw new Error('Invalid Facility ID format');
    }

    // Fetch facility operating hours and existing bookings concurrently
    const facilityPromise = Facility.findById(facilityId).select('operatingHours name'); // Select name for logs

    // Default to current month if not provided
    const targetMonthQuery = req.query.month; // e.g., "2024-09"
    let targetDate;
    if (targetMonthQuery && /^\d{4}-\d{2}$/.test(targetMonthQuery)) {
         targetDate = new Date(targetMonthQuery + '-01T00:00:00.000Z'); // Use UTC to avoid timezone issues
         console.log(`[Availability] Target month from query: ${targetMonthQuery}, Parsed Date: ${targetDate.toISOString()}`);
    } else {
         targetDate = new Date();
         targetDate.setUTCDate(1); // Go to the first day of the current month
         targetDate.setUTCHours(0, 0, 0, 0);
         console.log(`[Availability] No month query param, using current month. Parsed Date: ${targetDate.toISOString()}`);
    }

    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth(); // 0-indexed (0 for January)

    // Calculate start and end dates for the query
    const startDate = new Date(Date.UTC(year, month, 1));
    // End date is the first millisecond of the *next* month
    const endDate = new Date(Date.UTC(year, month + 1, 1));
    console.log(`[Availability] Querying bookings between: ${startDate.toISOString()} and ${endDate.toISOString()}`);


    const bookingsPromise = Booking.find({
        facility: facilityId, // Use facilityId here
        // Query for bookings starting within the target month
        date: { $gte: startDate, $lt: endDate }, // Use $lt for end date
        status: { $nin: ['cancelled', 'failed'] } // Exclude cancelled/failed bookings
    }).select('date timeSlot');

    const [facility, bookings] = await Promise.all([facilityPromise, bookingsPromise]);

    if (!facility) {
        console.error(`[Availability] Facility not found for ID: ${facilityId}`);
        res.status(404);
        throw new Error('Facility not found');
    }
    console.log(`[Availability] Found Facility: ${facility.name}`); // Log facility name
    console.log(`[Availability] Fetched ${bookings.length} relevant bookings for the month.`); // Log booking count

     if (!facility.operatingHours || facility.operatingHours.length === 0) {
         // If no operating hours are defined, return empty or indicate unavailability
         console.warn(`[Availability] Facility ${facility.name} has no defined operating hours. Returning empty.`);
         return res.json([]); // Or res.status(404).json({ message: 'Operating hours not defined for this facility' });
     }
     console.log(`[Availability] Facility Operating Hours:`, facility.operatingHours); // Log operating hours

    // Process bookings into a map for quick lookup: dateString -> Set<timeSlot>
    const bookedSlotsMap = new Map();
    bookings.forEach(booking => {
        // Ensure date is treated as UTC
        const bookingDate = new Date(booking.date);
        const dateString = bookingDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        if (!bookedSlotsMap.has(dateString)) {
            bookedSlotsMap.set(dateString, new Set());
        }
        bookedSlotsMap.get(dateString).add(booking.timeSlot);
    });
    console.log('[Availability] Booked Slots Map:', bookedSlotsMap); // Log the created map

    // Generate availability data for the month
    const availabilityData = [];
    const currentDate = new Date(startDate); // Start from the beginning of the target month
    const today = new Date(); // For checking if a date is in the past
    today.setUTCHours(0, 0, 0, 0); // Normalize today to UTC start of day
    console.log(`[Availability] Today (UTC Start): ${today.toISOString()}`);

    // Define potential slots (Consider making this dynamic or configurable per facility)
    const potentialSlots = [
        '06:00-08:00', '08:00-10:00', '10:00-12:00', '12:00-14:00',
        '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00'
        // Add more slots if needed, e.g., '22:00-00:00'
    ];
    console.log(`[Availability] Potential Slots Definition:`, potentialSlots);


    // Loop through each day of the target month
    console.log(`[Availability] Starting day loop for month ${month + 1}/${year}...`);
    while (currentDate.getUTCMonth() === month && currentDate.getUTCFullYear() === year) {
        const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
        // Get day name in English (e.g., "Monday") - Use UTC day
        const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        console.log(`\n[Availability] Processing Day: ${dateString} (${dayOfWeek})`); // Log current day

        const operatingHoursToday = facility.operatingHours.find(h => h.day.toLowerCase() === dayOfWeek.toLowerCase());
        console.log(`[Availability] Operating Hours for ${dayOfWeek}:`, operatingHoursToday); // Log today's hours
        const bookedSlotsToday = bookedSlotsMap.get(dateString) || new Set();
        console.log(`[Availability] Booked Slots for ${dateString}:`, bookedSlotsToday); // Log booked slots
        const isPast = currentDate < today; // Check if the date is before today
        console.log(`[Availability] Is Past Date? ${isPast}`);

        const slotsForDay = [];
        if (operatingHoursToday && !isPast) {
            // Parse open/close times (assuming HH:MM format)
            let openHour = 99, openMinute = 99, closeHour = -1, closeMinute = -1; // Init with impossible values
             try {
                 [openHour, openMinute] = operatingHoursToday.open.split(':').map(Number);
                 [closeHour, closeMinute] = operatingHoursToday.close.split(':').map(Number);
                 console.log(`[Availability] Parsed Open: ${openHour}:${openMinute}, Close: ${closeHour}:${closeMinute}`);
             } catch (parseError) {
                 console.error(`[Availability] Error parsing operating hours for ${dateString}: ${operatingHoursToday.open}-${operatingHoursToday.close}`, parseError);
                 // Skip slot generation for this day if parsing fails
                 potentialSlots.forEach(timeSlot => slotsForDay.push({ time: timeSlot, available: false }));
                 availabilityData.push({ date: dateString, slots: slotsForDay });
                 currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Move to next day
                 continue; // Skip to next iteration of while loop
             }


            potentialSlots.forEach(timeSlot => {
                 console.log(`[Availability]   Checking slot: ${timeSlot}`);
                const [slotStartStr, slotEndStr] = timeSlot.split('-');
                const [slotStartHour, slotStartMinute] = slotStartStr.split(':').map(Number);
                // Calculate end hour based on start (assuming 2-hour slots for this example)
                 // !! IMPORTANT: Adjust this logic if your slots aren't always 2 hours !!
                 let slotEndHour = slotStartHour + 2;
                 let slotEndMinute = slotStartMinute; // Assuming end minute is same as start

                 // Handle midnight wrap-around if needed (e.g., 22:00-00:00 slot)
                 if (slotEndHour >= 24) {
                     slotEndHour = slotEndHour % 24; // Correct hour (e.g., 00)
                     // If close time is also midnight (00:00), handle comparison carefully
                 }
                 console.log(`[Availability]     Slot Start/End Times: ${slotStartHour}:${slotStartMinute} - ${slotEndHour}:${slotEndMinute}`);


                // Check if the slot *starts* within or at the opening time
                const startsAfterOpen = slotStartHour > openHour || (slotStartHour === openHour && slotStartMinute >= openMinute);
                // Check if the slot *ends* within or at the closing time
                // Note: If close is 22:00, a 20:00-22:00 slot should be allowed.
                 // Handle closing time being 00:00 (midnight next day)
                 const effectiveCloseHour = closeHour === 0 ? 24 : closeHour;
                 const effectiveCloseMinute = closeMinute;

                 const endsBeforeClose = slotEndHour < effectiveCloseHour || (slotEndHour === effectiveCloseHour && slotEndMinute <= effectiveCloseMinute);

                 console.log(`[Availability]     Starts After Open? ${startsAfterOpen} (SlotStart>=Open -> ${slotStartHour}:${slotStartMinute} >= ${openHour}:${openMinute})`);
                 console.log(`[Availability]     Ends Before Close? ${endsBeforeClose} (SlotEnd<=Close -> ${slotEndHour}:${slotEndMinute} <= ${effectiveCloseHour}:${effectiveCloseMinute})`);


                let isAvailable = false;
                if (startsAfterOpen && endsBeforeClose) {
                    // Slot is within operating hours, now check if booked
                    const isBooked = bookedSlotsToday.has(timeSlot);
                    isAvailable = !isBooked;
                     console.log(`[Availability]     Within Hours. Is Booked? ${isBooked}. Is Available? ${isAvailable}`);
                } else {
                     console.log(`[Availability]     Slot is OUTSIDE operating hours.`);
                }

                slotsForDay.push({
                    time: timeSlot,
                    available: isAvailable
                });
            });
        } else {
             // Facility closed on this day or the date is in the past
             console.log(`[Availability]   Facility Closed or Date is Past. Marking all slots unavailable.`);
             potentialSlots.forEach(timeSlot => slotsForDay.push({ time: timeSlot, available: false }));
        }

        availabilityData.push({
            date: dateString,
            slots: slotsForDay
        });

        // Move to the next day (UTC)
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    console.log(`[Availability] Finished day loop. Total days processed: ${availabilityData.length}`);
    console.log(`[Availability] Final Availability Data being sent:`, availabilityData); // Log final data

    res.json(availabilityData);
});


// @desc    Get reviews for a specific facility (with pagination)
// @route   GET /api/facilities/:id/reviews
// @access  Public
const getFacilityReviews = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        throw new Error('Invalid Facility ID format');
    }

    const pageSize = 5; // Number of reviews per page
    const page = Number(req.query.pageNumber) || 1;

    const query = { facility: req.params.id };

    const count = await Review.countDocuments(query);
    const reviews = await Review.find(query)
        .populate('user', 'name avatar') // Populate user details
        .sort({ reviewDate: -1 }) // Sort by newest first
        .limit(pageSize)
        .skip(pageSize * (page - 1));

    res.json({
        reviews,
        page,
        pages: Math.ceil(count / pageSize),
        count
    });
});

// --- TODO: Implement Update and Delete Facility Controllers ---
// const updateFacility = asyncHandler(async (req, res) => { ... }); // Implemented in adminController
// const deleteFacility = asyncHandler(async (req, res) => { ... }); // Implemented in adminController


module.exports = {
  createFacility, // Export the new function
  getFacilities,
  getFeaturedFacilities,
  getFacilityById,
  getFacilityAvailability,
  getFacilityReviews,
  // updateFacility, // Handled by adminController
  // deleteFacility, // Handled by adminController
};
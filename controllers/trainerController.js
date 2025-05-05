// controllers/trainerController.js
const asyncHandler = require('express-async-handler');
const Trainer = require('../models/Trainer');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Facility = require('../models/Facility'); // Keep if needed for populating facility in response
const User = require('../models/User'); // <-- ADD Import for User model
const mongoose = require('mongoose');
const createNotification = require('../utils/createNotification');
const sendEmail = require('../utils/sendEmail'); // <-- ADD Import for sendEmail
const { format } = require('date-fns');

// --- Helper function to format currency ---
const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return 'N/A';
    return `Rs. ${amount.toLocaleString('en-LK')}`;
};

// @desc    Get trainers with filtering, searching, pagination
// @route   GET /api/trainers
// @access  Public
const getTrainers = asyncHandler(async (req, res) => {
    // ... existing getTrainers logic ...
    const pageSize = Number(req.query.limit) || 10;
    const page = Number(req.query.pageNumber) || 1;
    const query = {};
    if (req.query.keyword) { query.$or = [ { name: { $regex: req.query.keyword, $options: 'i' } }, { specialization: { $regex: req.query.keyword, $options: 'i' } }, { bio: { $regex: req.query.keyword, $options: 'i' } }, ]; }
    if (req.query.sport && req.query.sport !== 'all') { query.sports = { $regex: new RegExp(req.query.sport, 'i') }; }
    if (req.query.location && req.query.location !== 'all') { query.location = { $regex: req.query.location, $options: 'i' }; }
    if (req.query.rating && req.query.rating !== 'all') { query.rating = { $gte: Number(req.query.rating) }; }
    if (req.query.minPrice) { query.hourlyRate = { ...query.hourlyRate || {}, $gte: Number(req.query.minPrice) }; }
    if (req.query.maxPrice) { query.hourlyRate = { ...query.hourlyRate || {}, $lte: Number(req.query.maxPrice) }; }
    if (req.query.associatedFacilityId && mongoose.Types.ObjectId.isValid(req.query.associatedFacilityId)) {
        query.associatedFacilities = req.query.associatedFacilityId;
    }
    let sortOption = { rating: -1 };
    if (req.query.sort) { switch (req.query.sort) { case 'hourlyRate': sortOption = { hourlyRate: 1 }; break; case '-hourlyRate': sortOption = { hourlyRate: -1 }; break; case '-experienceYears': sortOption = { experienceYears: -1 }; break; default: sortOption = { rating: -1 }; break; } }
    const count = await Trainer.countDocuments(query);
    const trainers = await Trainer.find(query).limit(pageSize).skip(pageSize * (page - 1)).sort(sortOption).populate('associatedFacilities', 'name location');
    res.json({ trainers, page, pages: Math.ceil(count / pageSize), count });
});

// @desc    Get single trainer details by ID
// @route   GET /api/trainers/:id
// @access  Public
const getTrainerById = asyncHandler(async (req, res) => {
    // ... existing getTrainerById logic ...
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) { res.status(400); throw new Error('Invalid Trainer ID'); }
    const trainer = await Trainer.findById(req.params.id).populate('associatedFacilities', 'name location images');
    if (trainer) {
        const reviews = await Review.find({ trainer: trainer._id }).populate('user', 'name avatar').sort({ reviewDate: -1 }).limit(5);
        const trainerWithReviews = { ...trainer.toObject(), reviews };
        res.json(trainerWithReviews);
    } else { res.status(404); throw new Error('Trainer not found'); }
});

// @desc    Get reviews for a specific trainer
// @route   GET /api/trainers/:id/reviews
// @access  Public
const getTrainerReviews = asyncHandler(async (req, res) => {
    // ... existing getTrainerReviews logic ...
     if (!mongoose.Types.ObjectId.isValid(req.params.id)) { res.status(400); throw new Error('Invalid Trainer ID'); }
    const trainerExists = await Trainer.exists({ _id: req.params.id });
    if (!trainerExists) { res.status(404); throw new Error('Trainer not found'); }
    const pageSize = Number(req.query.limit) || 10;
    const page = Number(req.query.pageNumber) || 1;
    const count = await Review.countDocuments({ trainer: req.params.id });
    const reviews = await Review.find({ trainer: req.params.id }).populate('user', 'name avatar').sort({ reviewDate: -1 }).limit(pageSize).skip(pageSize * (page - 1));
    res.json({ reviews, page, pages: Math.ceil(count / pageSize), count });
});

// @desc    Book a session with a trainer
// @route   POST /api/trainers/:id/book
// @access  Private
const bookSession = asyncHandler(async (req, res) => {
    console.log(`--- [bookSession] Entered for Trainer ID: ${req.params.id} ---`);
    const trainerId = req.params.id;

    // 1. Validate Trainer ID & Fetch Trainer
    if (!mongoose.Types.ObjectId.isValid(trainerId)) { /* ... */ }
    const trainer = await Trainer.findById(trainerId).select('name hourlyRate availability userAccount');
    if (!trainer) { /* ... */ }
    console.log(`[bookSession] Found Trainer: ${trainer.name}`);

    // 2. Get User ID & Fetch User Details
    if (!req.user || !req.user._id) { /* ... */ }
    const userId = req.user._id;
    console.log(`[bookSession] User ID: ${userId}`);
    // --- Fetch User Email ---
    const user = await User.findById(userId).select('email name'); // Fetch user's email and name
    if (!user) {
       console.error(`[bookSession] User not found for ID: ${userId}. Cannot send confirmation email.`);
       // Decide handling: proceed or throw error? Proceeding for now.
    }

    // 3. Extract and Validate Booking Data
    const { date, timeSlot, facility: facilityId, participants = 1, sessionHours = 1, specialRequests } = req.body;
    console.log("[bookSession] Received Data:", req.body);
    if (!date || !timeSlot) { /* ... */ }
    const bookingDate = new Date(date + 'T00:00:00.000Z');
    if (isNaN(bookingDate.getTime())) { /* ... */ }
    const durationHours = Number(sessionHours);
    if (isNaN(durationHours) || durationHours <= 0) { /* ... */ }
    if (facilityId && !mongoose.Types.ObjectId.isValid(facilityId)) { /* ... */ }
    console.log("[bookSession] Input validation passed");

    // 4. Availability Check (Trainer)
    console.log("[bookSession] Checking trainer availability:", { trainerId, date: bookingDate, timeSlot });
    const existingTrainerBooking = await Booking.findOne({ /* ... */ });
    if (existingTrainerBooking) { /* ... */ }
    console.log("[bookSession] Trainer availability check passed");

    // 5. Calculate Cost
    console.log(`[bookSession] Calculating cost: Rate=${trainer.hourlyRate}, Hours=${durationHours}`);
    const calculatedTrainerCost = (trainer.hourlyRate || 0) * durationHours;
    const totalCost = calculatedTrainerCost; // Base cost is trainer cost
    console.log("[bookSession] Costs calculated:", { calculatedTrainerCost, totalCost });
    if (isNaN(totalCost)) { /* ... */ }

    // 6. Create Booking Document
    const bookingDataToSave = {
        user: userId,
        trainer: trainerId,
        facility: facilityId || undefined,
        bookingType: 'trainer',
        date: bookingDate,
        timeSlot,
        durationHours,
        participants: Number(participants),
        specialRequests: specialRequests?.trim() || undefined, // <-- Ensure specialRequests is included
        trainerCost: calculatedTrainerCost,
        totalCost,
        paymentStatus: 'pending',
        status: 'upcoming',
    };
    console.log("[bookSession] Booking data prepared for save:", JSON.stringify(bookingDataToSave, null, 2));

    const booking = new Booking(bookingDataToSave);
    console.log("[bookSession] Booking instance created, attempting save...");

    try {
        const createdBooking = await booking.save();
        console.log("[bookSession] Trainer Booking saved! ID:", createdBooking._id, "BookingId:", createdBooking.bookingId);

        const formattedDate = format(createdBooking.date, 'MMM d, yyyy');
        const targetName = `session with ${trainer.name}`; // Define target name

        // --- Send Notification ---
         await createNotification(
             userId,
             'booking_created',
             `Your training ${targetName} on ${formattedDate} at ${createdBooking.timeSlot} is confirmed! (#${createdBooking.bookingId})`,
             {
                 link: `/bookings/${createdBooking._id}`,
                 relatedBookingId: createdBooking._id,
                 relatedUser: trainer.userAccount
             }
         );
        // --- End Notification ---

        // --- SEND EMAIL CONFIRMATION ---
        if (user && user.email) {
            const emailSubject = `Booking Confirmed: Training with ${trainer.name} - ${formattedDate}`;
            // Fetch facility details if booked at a specific facility
            let facilityDetailsHtml = '';
            if (createdBooking.facility) {
                 const bookedFacility = await Facility.findById(createdBooking.facility).select('name address location');
                 if (bookedFacility) {
                     facilityDetailsHtml = `<p><strong>Location:</strong> ${bookedFacility.name} (${bookedFacility.address || bookedFacility.location})</p>`;
                 }
            }
             const specialRequestsHtml = createdBooking.specialRequests ? `<p><strong>Special Requests:</strong> ${createdBooking.specialRequests}</p>` : '';

            const emailHtml = `
               <div style="font-family: sans-serif; line-height: 1.6;">
                   <h1 style="color: #059669;">Booking Confirmed!</h1>
                   <p>Hi ${user.name || 'User'},</p>
                   <p>Your training session with <strong>${trainer.name}</strong> is confirmed. Here are the details:</p>
                   <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; border-left: 4px solid #10B981;">
                       <p><strong>Booking ID:</strong> ${createdBooking.bookingId}</p>
                       <p><strong>Trainer:</strong> ${trainer.name}</p>
                       <p><strong>Date:</strong> ${formattedDate}</p>
                       <p><strong>Time:</strong> ${createdBooking.timeSlot}</p>
                       <p><strong>Duration:</strong> ${createdBooking.durationHours} hour(s)</p>
                       ${facilityDetailsHtml}
                       <p><strong>Participants:</strong> ${createdBooking.participants}</p>
                       ${specialRequestsHtml}
                   </div>
                   <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                   <p><strong>Total Cost:</strong> ${formatCurrency(createdBooking.totalCost)}</p>
                   <p><strong>Payment Status:</strong> ${createdBooking.paymentStatus}</p>
                   <p style="margin-top: 25px;">Thank you for using SportsBookSL!</p>
                   <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${createdBooking._id}" style="display: inline-block; padding: 10px 15px; background-color: #059669; color: white; text-decoration: none; border-radius: 5px;">View Booking Details</a></p>
                   <p style="font-size: 0.8em; color: #6b7280;">Please contact the trainer directly if you have specific questions about the session content.</p>
               </div>
            `;

            try {
               await sendEmail({
                   email: user.email,
                   subject: emailSubject,
                   html: emailHtml,
               });
            } catch (emailError) {
                console.error(`[bookSession] Failed to send confirmation email to ${user.email} for booking ${createdBooking._id}:`, emailError);
            }
        } else {
            console.warn(`[bookSession] Could not send email confirmation for booking ${createdBooking._id}: User email not found.`);
        }
        // --- END SEND EMAIL ---


        // Populate details for the response
        const populatedBooking = await Booking.findById(createdBooking._id)
            .populate('trainer', 'name specialization profileImage')
            .populate('user', 'name email')
            .populate('facility', 'name location');

        if (!populatedBooking) {
             console.error("!!! Failed to populate trainer booking after saving. ID:", createdBooking._id);
             res.status(201).json(createdBooking); // Send unpopulated as fallback
        } else {
            console.log("[bookSession] Trainer Booking populated successfully.");
            res.status(201).json(populatedBooking); // Send populated booking
        }
    } catch (dbError) {
        console.error("!!! Database Save Error in bookSession:", dbError);
        res.status(500);
        if (dbError.name === 'ValidationError') {
             console.error("[bookSession] Validation Error Details:", dbError.errors);
             throw new Error(`Booking validation failed: ${dbError.message}`);
        }
        throw new Error("Failed to save trainer booking to database.");
    }
});

// --- Keep updateTrainerProfile ---
const updateTrainerProfile = asyncHandler(async (req, res) => {
    // ... existing updateTrainerProfile logic ...
    const userId = req.user._id;
    const trainer = await Trainer.findOne({ userAccount: userId });
    if (!trainer) { res.status(404); throw new Error('Trainer profile not found'); }
    const { name, specialization, sports, location, hourlyRate, availability, certifications, bio, languages } = req.body;
    if (name) trainer.name = name;
    if (specialization) trainer.specialization = specialization;
    if (sports) trainer.sports = sports;
    if (location) trainer.location = location;
    if (hourlyRate) trainer.hourlyRate = hourlyRate;
    if (availability) trainer.availability = availability;
    if (certifications) trainer.certifications = certifications;
    if (bio) trainer.bio = bio;
    if (languages) trainer.languages = languages;
    const updatedTrainer = await trainer.save();
    res.json(updatedTrainer);
});

module.exports = {
    getTrainers,
    getTrainerById,
    getTrainerReviews,
    bookSession,
    updateTrainerProfile,
};
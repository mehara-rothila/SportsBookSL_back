// controllers/bookingController.js
const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const Facility = require('../models/Facility');
const Trainer = require('../models/Trainer'); // Import Trainer model for fetching rate
const User = require('../models/User'); // Needed for user check and getting email
const mongoose = require('mongoose');
const createNotification = require('../utils/createNotification'); // Import the utility
const sendEmail = require('../utils/sendEmail'); // <-- IMPORT sendEmail
const { format } = require('date-fns'); // Import format function from date-fns

// Helper function to format currency (add if not present in this file)
const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return 'N/A';
    return `Rs. ${amount.toLocaleString('en-LK')}`;
};

// @desc    Create a new booking (Facility or Trainer)
// @route   POST /api/bookings
// @access  Private
const createBooking = asyncHandler(async (req, res) => {
    console.log("\n--- [createBooking] Entered ---");
    console.log("[createBooking] Received Raw Body:", req.body);

    const {
        facility: facilityId,
        trainer: trainerId,
        date, // Expecting YYYY-MM-DD string
        timeSlot, // Expecting "HH:MM-HH:MM" string (ensure consistent format from frontend)
        participants,
        sessionHours, // Added for trainer booking duration flexibility
        rentedEquipment: equipmentRequest, // Expecting [{ equipmentName: '...', quantity: ... }]
        needsTransportation,
        specialRequests
    } = req.body;

    // --- User ID ---
    const userId = req.user?._id;
    if (!userId) {
        res.status(401);
        throw new Error('User not authenticated or user ID missing');
    }
    console.log("[createBooking] User ID:", userId);

    // --- Fetch User Email ---
    const user = await User.findById(userId).select('email name'); // Fetch user's email and name
    if (!user) {
        console.error(`[createBooking] User not found for ID: ${userId}. Cannot send confirmation email.`);
        // Decide if you want to proceed without email or throw an error
        // For now, we'll proceed but log the issue.
    }

    // --- Basic Validation ---
    if (!date || !timeSlot || !participants) {
        res.status(400); throw new Error('Missing required fields: date, timeSlot, participants');
    }
    if (!facilityId && !trainerId) {
         res.status(400); throw new Error('Booking must be associated with either a facility or a trainer.');
    }
    if (facilityId && !mongoose.Types.ObjectId.isValid(facilityId)) {
        res.status(400); throw new Error('Invalid Facility ID format');
    }
    if (trainerId && !mongoose.Types.ObjectId.isValid(trainerId)) {
        res.status(400); throw new Error('Invalid Trainer ID format');
    }
    const bookingDate = new Date(date + 'T00:00:00.000Z'); // Parse date as UTC start of day
    if (isNaN(bookingDate.getTime())) {
        res.status(400); throw new Error('Invalid date format. Use YYYY-MM-DD.');
    }
    console.log("[createBooking] Parsed Booking Date (UTC):", bookingDate);


    // --- Determine Booking Type & Fetch Primary Target ---
    let facility = null;
    let trainer = null;
    let targetName = 'a session'; // Default target name
    let bookingType = facilityId ? 'facility' : 'trainer'; // Determine type
    let targetModelId = facilityId || trainerId; // The primary ID for availability check
    let facilityAddress = ''; // Variable to store address for email

    if (bookingType === 'facility') {
        facility = await Facility.findById(facilityId).select('name pricePerHourValue equipmentForRent operatingHours address location'); // Added address/location
        if (!facility) { res.status(404); throw new Error('Facility not found'); }
        targetName = facility.name; // Set target name to facility name
        facilityAddress = facility.address || facility.location; // Get address for email
        console.log("[createBooking] Booking Type: Facility -", facility.name);
        if (trainerId) {
            trainer = await Trainer.findById(trainerId).select('name hourlyRate userAccount'); // Also fetch userAccount
             if (!trainer) { console.warn(`Trainer ${trainerId} requested but not found.`); trainerId = undefined; }
             else { console.log("[createBooking] Also booking Trainer:", trainer.name); }
        }
    } else { // bookingType === 'trainer'
         trainer = await Trainer.findById(trainerId).select('name hourlyRate userAccount'); // Also fetch userAccount
         if (!trainer) { res.status(404); throw new Error('Trainer not found'); }
         targetName = `session with ${trainer.name}`; // Set target name for trainer
         console.log("[createBooking] Booking Type: Trainer -", trainer.name);
         if (facilityId) {
            facility = await Facility.findById(facilityId).select('name equipmentForRent address location'); // Added address/location
            if (!facility) { console.warn(`Facility ${facilityId} requested with trainer but not found.`); facilityId = undefined; }
            else {
                console.log("[createBooking] Trainer session booked at Facility:", facility.name);
                facilityAddress = facility.address || facility.location; // Get address for email
            }
         }
    }

    // --- Availability Check ---
    const availabilityQuery = { date: bookingDate, timeSlot, status: { $in: ['upcoming', 'completed'] } };
    availabilityQuery[bookingType] = targetModelId;
    console.log(`[createBooking] Checking ${bookingType} availability for:`, availabilityQuery);
    const existingBooking = await Booking.findOne(availabilityQuery);
    if (existingBooking) { res.status(409); throw new Error(`${bookingType === 'facility' ? 'Facility' : 'Trainer'} is not available at the selected date and time slot.`); }
    if (facilityId && trainerId) {
         const secondaryType = bookingType === 'facility' ? 'trainer' : 'facility';
         const secondaryId = bookingType === 'facility' ? trainerId : facilityId;
         const secondaryAvailabilityQuery = { date: bookingDate, timeSlot, status: { $in: ['upcoming', 'completed'] } };
         secondaryAvailabilityQuery[secondaryType] = secondaryId;
         console.log(`[createBooking] Checking secondary (${secondaryType}) availability for:`, secondaryAvailabilityQuery);
         const existingSecondaryBooking = await Booking.findOne(secondaryAvailabilityQuery);
         if (existingSecondaryBooking) { res.status(409); throw new Error(`The selected ${secondaryType} is not available at the selected date and time slot (conflict).`); }
     }
    console.log("[createBooking] Availability check passed");

    // --- Calculate Costs ---
    console.log("[createBooking] Calculating costs...");
     // **** Initialize cost variables ****
     let durationHours = 2; // Default duration (adjust if needed)
     let facilityCost = 0;
     let calculatedEquipmentCost = 0;
     let transportationCost = 0;
     let calculatedTrainerCost = 0;
     let rentedEquipmentDetails = [];
     // **** End Initialization ****

     // Facility costs apply if a facility is the main target OR if a trainer is booked AT a facility
     if (facility) {
         // Only charge facility cost if it's the primary booking type
         if (bookingType === 'facility' && facility.pricePerHourValue) {
             facilityCost = facility.pricePerHourValue * durationHours; // Assuming durationHours is set correctly later
             console.log(`[createBooking] Calculated Facility Cost: ${facilityCost} for ${durationHours} hours`);
         } else {
             console.log("[createBooking] Facility involved, but not primary target or no price value. Facility cost: 0");
         }

        // Calculate Equipment Cost (only if a facility is involved)
        if (equipmentRequest && Array.isArray(equipmentRequest)) {
            console.log("[createBooking] Processing equipment request:", equipmentRequest);
            for (const item of equipmentRequest) {
                 const { equipmentName, quantity } = item;
                if (!equipmentName || !quantity || quantity <= 0) { continue; }
                 const equipDetail = facility.equipmentForRent?.find(e => e.name === equipmentName);
                if (equipDetail && equipDetail.available >= quantity) {
                    // Ensure durationHours is set correctly before this point if it depends on trainer
                    const itemDuration = (bookingType === 'trainer' && sessionHours) ? Number(sessionHours) : durationHours;
                    const cost = (equipDetail.pricePerHour || 0) * quantity * itemDuration;
                    calculatedEquipmentCost += cost;
                    rentedEquipmentDetails.push({ equipmentName: equipDetail.name, quantity, pricePerItemPerHour: equipDetail.pricePerHour || 0 });
                     console.log(`[createBooking] Added equipment: ${equipmentName} x${quantity}, Cost: ${cost}`);
                 } else { console.warn(`[createBooking] Equip "${equipmentName}" ignored (Not found/low stock:${equipDetail?.available})`); }
            }
        }
     }

     // Trainer costs apply if a trainer is the main target OR if booked alongside a facility
    if (trainer) {
         // Use specific sessionHours for trainer if provided, else fallback to default duration
         const trainerDuration = (bookingType === 'trainer' && sessionHours) ? Number(sessionHours) : durationHours;
         if (isNaN(trainerDuration) || trainerDuration <= 0) throw new Error("Invalid session duration");
         calculatedTrainerCost = (trainer.hourlyRate || 0) * trainerDuration;
         // IMPORTANT: If trainer is primary, update the main durationHours used for booking record
         if (bookingType === 'trainer') {
             durationHours = trainerDuration;
         }
         console.log(`[createBooking] Added trainer cost: ${calculatedTrainerCost} for ${trainerDuration} hours`);
    }

    transportationCost = needsTransportation ? 1000 : 0; // Example fixed cost

    const totalCost = facilityCost + calculatedEquipmentCost + transportationCost + calculatedTrainerCost;
    console.log("[createBooking] Final Costs:", { facilityCost, calculatedEquipmentCost, transportationCost, calculatedTrainerCost, totalCost });

    // --- Create Booking Document ---
    const bookingDataToSave = {
        user: userId,
        facility: facilityId || undefined,
        trainer: trainerId || undefined,
        bookingType: bookingType,
        bookingId: undefined, // Let the default generator work
        date: bookingDate,
        timeSlot,
        durationHours, // Use potentially adjusted duration
        participants: Number(participants) || 1,
        rentedEquipment: rentedEquipmentDetails.length > 0 ? rentedEquipmentDetails : undefined,
        needsTransportation: !!needsTransportation,
        specialRequests: specialRequests?.trim() || undefined,
        facilityCost: facilityCost, // Use the calculated (possibly 0) value
        equipmentCost: calculatedEquipmentCost,
        transportationCost: transportationCost,
        trainerCost: calculatedTrainerCost,
        totalCost,
        paymentStatus: 'pending', // Default (change after payment integration)
        status: 'upcoming',      // Default
    };

    const booking = new Booking(bookingDataToSave);
    console.log("[createBooking] Booking instance created, attempting save...");

    try {
        const createdBooking = await booking.save();
        console.log("[createBooking] Booking saved! ID:", createdBooking._id, "BookingId:", createdBooking.bookingId);

        // --- Send Notification ---
        const formattedDate = format(createdBooking.date, 'MMM d, yyyy');
        await createNotification(
             userId, // The user making the booking
             'booking_created',
             `Your booking for ${targetName} on ${formattedDate} at ${createdBooking.timeSlot} is confirmed! (#${createdBooking.bookingId})`,
             {
                 link: `/bookings/${createdBooking._id}`, // Link to user's booking detail page
                 relatedBookingId: createdBooking._id,
                 relatedUser: bookingType === 'trainer' ? trainer?.userAccount : undefined // Add trainer user if applicable
             }
        );
        // --- End Notification ---

        // --- SEND EMAIL CONFIRMATION ---
        if (user && user.email) { // Check if user and email exist
             const emailSubject = `Booking Confirmed: ${targetName} - ${formattedDate}`;
             // Construct more detailed HTML email
             const equipmentListHtml = createdBooking.rentedEquipment && createdBooking.rentedEquipment.length > 0
                 ? `<h3>Rented Equipment:</h3><ul>${createdBooking.rentedEquipment.map(item => `<li>${item.quantity}x ${item.equipmentName}</li>`).join('')}</ul>`
                 : '';
             const transportationHtml = createdBooking.needsTransportation ? '<p><strong>Transportation:</strong> Requested (Details to follow)</p>' : '';
             const specialRequestsHtml = createdBooking.specialRequests ? `<p><strong>Special Requests:</strong> ${createdBooking.specialRequests}</p>` : '';
             const locationHtml = facilityAddress ? `<p><strong>Location:</strong> ${facilityAddress}</p>` : '';

             const emailHtml = `
                <div style="font-family: sans-serif; line-height: 1.6;">
                    <h1 style="color: #059669;">Booking Confirmed!</h1>
                    <p>Hi ${user.name || 'User'},</p>
                    <p>Your booking for <strong>${targetName}</strong> is confirmed. Here are the details:</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; border-left: 4px solid #10B981;">
                        <p><strong>Booking ID:</strong> ${createdBooking.bookingId}</p>
                        <p><strong>Date:</strong> ${formattedDate}</p>
                        <p><strong>Time:</strong> ${createdBooking.timeSlot}</p>
                        ${locationHtml}
                        <p><strong>Participants:</strong> ${createdBooking.participants}</p>
                        ${transportationHtml}
                        ${specialRequestsHtml}
                    </div>
                    ${equipmentListHtml}
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                    <p><strong>Total Cost:</strong> ${formatCurrency(createdBooking.totalCost)}</p>
                    <p><strong>Payment Status:</strong> ${createdBooking.paymentStatus}</p>
                    <p style="margin-top: 25px;">Thank you for using SportsBookSL!</p>
                    <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${createdBooking._id}" style="display: inline-block; padding: 10px 15px; background-color: #059669; color: white; text-decoration: none; border-radius: 5px;">View Booking Details</a></p>
                    <p style="font-size: 0.8em; color: #6b7280;">If you did not make this booking, please contact our support team immediately.</p>
                </div>
             `;

             try {
                await sendEmail({
                    email: user.email,
                    subject: emailSubject,
                    html: emailHtml,
                });
             } catch (emailError) {
                 console.error(`[createBooking] Failed to send confirmation email to ${user.email} for booking ${createdBooking._id}:`, emailError);
                 // Log the error, but don't fail the booking request itself
             }
        } else {
             console.warn(`[createBooking] Could not send email confirmation for booking ${createdBooking._id}: User email not found.`);
        }
        // --- END SEND EMAIL ---

        // Populate details for the response
        console.log("[createBooking] Populating booking details for response...");
        const populatedBooking = await Booking.findById(createdBooking._id)
            .populate('user', 'name email')
            .populate('facility', 'name location address images')
            .populate('trainer', 'name specialization profileImage');

        res.status(201).json(populatedBooking || createdBooking); // Send populated or fallback

    } catch (dbError) {
        console.error("!!! Database Save Error in createBooking:", dbError);
        res.status(500);
        if (dbError.name === 'ValidationError') { throw new Error(`Booking validation failed: ${dbError.message}`); }
        if (dbError instanceof ReferenceError) { // Catch specific ReferenceError
            console.error("ReferenceError details:", dbError);
            throw new Error(`Server error: A required variable was not defined (${dbError.message}). Please contact support.`);
        }
        throw new Error("Failed to save booking to database due to an internal error.");
    }
});


// @desc    Get details of a specific booking
// @route   GET /api/bookings/:id
// @access  Private (Owner or Admin)
const getBookingById = asyncHandler(async (req, res) => {
    console.log(`--- [getBookingById] Entered for ID: ${req.params.id} ---`);
    const bookingIdParam = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(bookingIdParam)) { res.status(400); throw new Error('Invalid Booking ID format'); }

    console.log(`[getBookingById] Fetching booking: ${bookingIdParam}`);
    const booking = await Booking.findById(bookingIdParam)
        .populate('user', 'name email phone')
        .populate('facility', 'name address images location pricePerHourValue contactInfo')
        .populate('trainer', 'name specialization profileImage hourlyRate')
        .lean();

    if (!booking) { res.status(404); throw new Error('Booking not found'); }
    console.log(`[getBookingById] Booking found.`);

    // --- Authorization Check ---
    if (!req.user) { res.status(401); throw new Error('Not authenticated'); }
    const bookingUserId = booking.user._id?.toString() ?? booking.user;
    if (bookingUserId !== req.user.id && req.user.role !== 'admin') {
        console.warn(`[getBookingById] Authorization failed. User ${req.user.id} tried to access booking ${booking._id} owned by ${bookingUserId}`);
        res.status(403); throw new Error('Not authorized to access this booking');
    }
    console.log(`[getBookingById] Authorization successful for user ${req.user.id}`);

    console.log("[getBookingById] Sending booking data.");
    res.status(200).json(booking);
});

// @desc    Get booking confirmation details (Public link?) - might be same as getBookingById but without strict auth
// @route   GET /api/bookings/confirmation/:id (Example Route) - Adjust as needed
const getBookingConfirmation = asyncHandler(async (req, res) => {
    console.log(`--- [getBookingConfirmation] Getting confirmation for ID: ${req.params.id} ---`);
    const bookingIdParam = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(bookingIdParam)) { res.status(400); throw new Error('Invalid Booking ID format'); }

    // Fetch with population similar to getBookingById
    const booking = await Booking.findById(bookingIdParam)
         .populate('user', 'name')
         .populate('facility', 'name address location')
         .populate('trainer', 'name specialization')
         .lean();

    if (!booking) { res.status(404); throw new Error('Booking confirmation not found'); }

    res.status(200).json(booking);
});

// @desc    Cancel a booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private (Owner or Admin)
const cancelBooking = asyncHandler(async (req, res) => {
    console.log(`--- [cancelBooking] Entered for ID: ${req.params.id} ---`);
    const bookingIdParam = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(bookingIdParam)) { res.status(400); throw new Error('Invalid Booking ID format'); }

    // Fetch booking and populate necessary details for email/notification
    const booking = await Booking.findById(bookingIdParam)
        .populate('user', 'email name _id') // Need email and ID for sending cancellation
        .populate('facility', 'name')
        .populate('trainer', 'name');

    if (!booking) { res.status(404); throw new Error('Booking not found'); }

    // Authorization Check: Owner or Admin
     if (!req.user) { res.status(401); throw new Error('Not authenticated'); }
     const bookingUserId = booking.user._id.toString(); // Use populated user ID
     if (bookingUserId !== req.user.id && req.user.role !== 'admin') { res.status(403); throw new Error('Not authorized to cancel this booking'); }


    if (booking.status === 'cancelled') { res.status(400); throw new Error(`Booking is already cancelled`); }
    if (booking.status === 'completed') { res.status(400); throw new Error(`Cannot cancel a completed booking`); }

    // --- Cancellation Window Logic ---
    const now = new Date();
    const bookingStartDateTime = new Date(booking.date);
    const hoursDifference = (bookingStartDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    console.log(`[cancelBooking] Hours difference for cancellation: ${hoursDifference}`);
    const CANCELLATION_WINDOW_HOURS = 24;
    if (req.user.role !== 'admin' && hoursDifference < CANCELLATION_WINDOW_HOURS) {
        res.status(400);
        throw new Error(`Cancellation window has passed (must be more than ${CANCELLATION_WINDOW_HOURS} hours before booking). Admins can override.`);
    }
    // --- End Cancellation Window Logic ---

    // --- Update Status & Handle Related Actions ---
    const oldStatus = booking.status;
    booking.status = 'cancelled';
    console.log(`[cancelBooking] Setting booking ${booking._id} status to cancelled.`);

    // TODO: Payment Refund Logic
    if (booking.paymentStatus === 'paid') {
        console.warn(`[cancelBooking] Booking ${booking._id} was paid. Refund logic needs implementation!`);
        // refundPayment(booking.paymentId);
        // booking.paymentStatus = 'refunded'; // Update payment status after successful refund
    }

    const updatedBooking = await booking.save();
    console.log(`[cancelBooking] Booking ${booking._id} cancelled successfully.`);

    // Determine target name for notification/email message
    let targetName = 'your session';
    if (booking.bookingType === 'facility' && booking.facility) {
        targetName = `your booking for ${booking.facility.name}`;
    } else if (booking.bookingType === 'trainer' && booking.trainer) {
        targetName = `your session with ${booking.trainer.name}`;
    }
    const formattedDate = format(updatedBooking.date, 'MMM d, yyyy');

    // --- Send Notification ---
    if (oldStatus !== 'cancelled') {
         await createNotification(
             bookingUserId, // Notify the user whose booking was cancelled
             'booking_status_update',
             `Confirmation: ${targetName} on ${formattedDate} at ${updatedBooking.timeSlot} has been cancelled. (#${updatedBooking.bookingId})`,
             {
                 link: `/bookings/${updatedBooking._id}`,
                 relatedBookingId: updatedBooking._id
             }
         );
         console.log(`[cancelBooking] Cancellation notification sent to user ${bookingUserId}.`);
    }
    // --- End Notification ---

    // --- Send Cancellation Email ---
    if (oldStatus !== 'cancelled' && booking.user && booking.user.email) {
        const emailSubject = `Booking Cancelled: ${targetName} on ${formattedDate}`;
        const emailHtml = `
           <div style="font-family: sans-serif; line-height: 1.6;">
               <h1 style="color: #DC2626;">Booking Cancelled</h1>
               <p>Hi ${booking.user.name || 'User'},</p>
               <p>This email confirms that ${targetName} scheduled for <strong>${formattedDate} at ${updatedBooking.timeSlot}</strong> (Booking ID: ${updatedBooking.bookingId}) has been cancelled.</p>
               ${booking.paymentStatus === 'paid' ? '<p>If applicable, a refund will be processed according to our cancellation policy. Please allow 5-10 business days for it to reflect in your account.</p>' : ''}
               <p>If you did not request this cancellation or have questions, please contact support immediately.</p>
               <p style="margin-top: 25px;"><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?tab=bookings" style="display: inline-block; padding: 10px 15px; background-color: #4B5563; color: white; text-decoration: none; border-radius: 5px;">View Your Bookings</a></p>
           </div>
        `;
        try {
            await sendEmail({
                email: booking.user.email,
                subject: emailSubject,
                html: emailHtml,
            });
        } catch (emailError) {
            console.error(`[cancelBooking] Failed to send cancellation email to ${booking.user.email} for booking ${updatedBooking._id}:`, emailError);
        }
    }
    // --- End Cancellation Email ---

    res.status(200).json({ message: 'Booking cancelled successfully', booking: updatedBooking });
});


module.exports = {
    createBooking,
    getBookingById,
    getBookingConfirmation,
    cancelBooking,
};
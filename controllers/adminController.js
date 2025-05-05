// sportsbook-sl-backend/controllers/adminController.js
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Facility = require('../models/Facility');
const Trainer = require('../models/Trainer');
const Booking = require('../models/Booking');
const Testimonial = require('../models/Testimonial');
const Athlete = require('../models/Athlete');
const Donation = require('../models/Donation');
const FinancialAidApplication = require('../models/FinancialAidApplication');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const createNotification = require('../utils/createNotification');
const { format } = require('date-fns');

// Helper function to safely delete a file
const safeUnlink = (filePath, label = 'file') => {
    if (filePath) {
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', 'public', filePath.startsWith('/') ? filePath : '/' + filePath);
        const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
        if (absolutePath.startsWith(uploadsDir)) {
            fs.unlink(absolutePath, (err) => {
                if (err && err.code !== 'ENOENT') { console.error(`Error deleting ${label} ${absolutePath}:`, err); } else if (!err) { console.log(`[safeUnlink] Successfully deleted ${label}: ${absolutePath}`); }
            });
        } else { console.warn(`[safeUnlink] Attempted to delete file outside of uploads directory: ${absolutePath}`); }
    }
};

// Helper function to format currency
const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return 'N/A';
    return `Rs. ${amount.toLocaleString('en-LK')}`;
};
// Helper function to format dates
const formatDate = (dateInput, formatString = 'PPP') => {
     if (!dateInput) return 'N/A';
     try { return format(new Date(dateInput), formatString); } catch (e) { return 'Invalid Date'; }
};


// ==============================
// User Management Functions
// ==============================
const getAllUsers = asyncHandler(async (req, res) => {
    console.log('[Admin] Fetching all users'); const users = await User.find({}).select('-password').sort({ createdAt: -1 }); res.status(200).json({ users });
});
const updateUserByAdmin = asyncHandler(async (req, res) => {
    const userId = req.params.id; const { name, email, phone, role, address } = req.body; if (!mongoose.Types.ObjectId.isValid(userId)) { res.status(400); throw new Error('Invalid User ID format'); } const user = await User.findById(userId); if (!user) { res.status(404); throw new Error('User not found'); } if (req.user.id === userId && (req.body.role !== undefined && req.body.role !== user.role)) { res.status(400); throw new Error('Admins cannot change their own role via this endpoint.'); } user.name = name ?? user.name; user.email = email ?? user.email; user.phone = phone ?? user.phone; user.role = role ?? user.role; user.address = address ?? user.address; const updatedUser = await user.save(); console.log(`[Admin] User ${userId} updated by admin ${req.user.id}`); res.status(200).json({ _id: updatedUser._id, name: updatedUser.name, email: updatedUser.email, phone: updatedUser.phone, role: updatedUser.role, address: updatedUser.address, avatar: updatedUser.avatar, createdAt: updatedUser.createdAt });
});
const deleteUserByAdmin = asyncHandler(async (req, res) => {
    const userId = req.params.id; if (!mongoose.Types.ObjectId.isValid(userId)) { res.status(400); throw new Error('Invalid User ID format'); } if (req.user.id === userId) { res.status(400); throw new Error('Admins cannot delete their own account.'); } const user = await User.findById(userId); if (!user) { res.status(404); throw new Error('User not found'); } if (user.avatar && user.avatar !== '/images/default-avatar.png' && user.avatar.startsWith('/uploads/')) { safeUnlink(user.avatar, 'user avatar'); } await User.findByIdAndDelete(userId); console.log(`[Admin] User ${userId} deleted by admin ${req.user.id}`); res.status(200).json({ message: 'User deleted successfully' });
});

// ==============================
// Facility Management Functions
// ==============================
const getAllAdminFacilities = asyncHandler(async (req, res) => {
    console.log('[Admin] Fetching all facilities'); try { const facilities = await Facility.find({}).sort({ name: 1 }).select('name location sportTypes pricePerHour rating isActive isFeatured images createdAt').lean(); console.log(`[Admin] Found ${facilities.length} facilities.`); res.status(200).json({ facilities }); } catch (error) { console.error("[Admin] Error fetching facilities:", error); res.status(500); throw new Error("Server error fetching facilities."); }
});
const getAdminFacilityById = asyncHandler(async (req, res) => {
    const facilityId = req.params.id; console.log(`[Admin] Getting facility by ID: ${facilityId}`); if (!mongoose.Types.ObjectId.isValid(facilityId)) { res.status(400); throw new Error('Invalid Facility ID format'); } const facility = await Facility.findById(facilityId).populate('associatedCoaches', 'name specialization'); if (facility) { res.status(200).json(facility); } else { res.status(404); throw new Error('Facility not found'); }
});
const updateFacilityByAdmin = asyncHandler(async (req, res) => {
    const facilityId = req.params.id;
    console.log(`[Admin] Attempting update for facility ID: ${facilityId}`);
    console.log("[Admin Update Facility] Body:", req.body);
    console.log("[Admin Update Facility] Files:", req.files);

    if (!req.body) { /* ... handle missing body ... */ if (req.files && req.files.length > 0) { req.files.forEach(file => safeUnlink(file.path, 'temp upload')); } res.status(400); throw new Error("Request body is missing."); return; }
    if (!mongoose.Types.ObjectId.isValid(facilityId)) { /* ... handle invalid ID ... */ res.status(400); throw new Error('Invalid Facility ID format'); return; }

    const facility = await Facility.findById(facilityId);
    if (!facility) { /* ... handle not found ... */ if (req.files && req.files.length > 0) { req.files.forEach(file => safeUnlink(file.path, 'temp upload')); } res.status(404); throw new Error('Facility not found'); return; }

    if (req.fileValidationError) { /* ... handle file validation error ... */ res.status(400); throw new Error(req.fileValidationError.message); return; }

    // Destructure all potential fields from body
    const {
        name, location, address, description, longDescription, sportTypes, amenities,
        pricePerHour, pricePerHourValue, pricePerDay, contactPhone, contactEmail,
        contactWebsite, mapLat, mapLng, isNew, isPremium, isFeatured, isActive,
        associatedCoaches, clearImages,
        operatingHours // Expecting JSON stringified array
    } = req.body;

    let operatingHoursModified = false; // Flag to track if hours changed

    // --- Update standard fields ---
    if (name !== undefined) facility.name = name;
    if (location !== undefined) facility.location = location;
    if (address !== undefined) facility.address = address;
    if (description !== undefined) facility.description = description;
    if (longDescription !== undefined) facility.longDescription = longDescription;
    if (pricePerHour !== undefined) facility.pricePerHour = pricePerHour;
    if (pricePerHourValue !== undefined) facility.pricePerHourValue = Number(pricePerHourValue);
    if (pricePerDay !== undefined) facility.pricePerDay = pricePerDay === '' ? null : Number(pricePerDay);

    // --- Update nested objects ---
    if (contactPhone !== undefined || contactEmail !== undefined || contactWebsite !== undefined) {
        facility.contactInfo = { phone: contactPhone ?? facility.contactInfo?.phone, email: contactEmail ?? facility.contactInfo?.email, website: contactWebsite ?? facility.contactInfo?.website };
    }
    if (mapLat !== undefined || mapLng !== undefined) {
        facility.mapLocation = { lat: mapLat !== undefined ? (mapLat === '' ? null : Number(mapLat)) : facility.mapLocation?.lat, lng: mapLng !== undefined ? (mapLng === '' ? null : Number(mapLng)) : facility.mapLocation?.lng };
    }

    // --- Update boolean flags ---
    if (isActive !== undefined) facility.isActive = String(isActive) === 'true';
    if (isNew !== undefined) facility.isNew = String(isNew) === 'true';
    if (isPremium !== undefined) facility.isPremium = String(isPremium) === 'true';
    if (isFeatured !== undefined) facility.isFeatured = String(isFeatured) === 'true';

    // --- Update arrays ---
    if (sportTypes !== undefined) facility.sportTypes = typeof sportTypes === 'string' ? sportTypes.split(',').map(s => s.trim()).filter(Boolean) : facility.sportTypes;
    if (amenities !== undefined) facility.amenities = typeof amenities === 'string' ? amenities.split(',').map(a => a.trim()).filter(Boolean) : facility.amenities;

    // --- Update Operating Hours ---
    if (operatingHours !== undefined) {
        try {
            let parsedHours = [];
            // Check if it's a non-empty string before parsing
            if (typeof operatingHours === 'string' && operatingHours.trim() !== '') {
                 parsedHours = JSON.parse(operatingHours);
            } else if (Array.isArray(operatingHours)) {
                // Handle case where it might already be an array (less likely with FormData)
                parsedHours = operatingHours;
            }

            // Basic validation (expand as needed)
            if (!Array.isArray(parsedHours)) {
                 throw new Error('Operating hours must be an array.');
            }
            const validFormat = parsedHours.every(h =>
                h && typeof h.day === 'string' && h.day &&
                typeof h.open === 'string' && /^\d{2}:\d{2}$/.test(h.open) &&
                typeof h.close === 'string' && /^\d{2}:\d{2}$/.test(h.close)
            );
            if (!validFormat && parsedHours.length > 0) { // Allow empty array
                throw new Error('Invalid operating hours format. Each entry needs day (string), open (HH:MM), close (HH:MM).');
            }

            // Only update if different from current hours to avoid unnecessary saves
            if (JSON.stringify(parsedHours) !== JSON.stringify(facility.operatingHours || [])) {
                 facility.operatingHours = parsedHours;
                 operatingHoursModified = true; // Set flag
                 console.log("[Admin Update Facility] Updated operatingHours:", facility.operatingHours);
            }
        } catch (e) {
            console.error("Error parsing/validating operatingHours:", e.message);
            res.status(400);
            throw new Error(`Invalid operating hours data: ${e.message}`);
            // No return here, let the main try/catch handle the throw
        }
    }
    // --- End Operating Hours Handling ---

    // --- Conditionally Update associatedCoaches (Fix for CastError) ---
    let coachesModified = false;
    if (associatedCoaches !== undefined) {
        try {
            const newCoachIds = typeof associatedCoaches === 'string' && associatedCoaches.trim() !== ''
                ? associatedCoaches.split(',').map(id => mongoose.Types.ObjectId(id.trim()))
                : [];
             if (JSON.stringify(newCoachIds.map(id=>id.toString())) !== JSON.stringify(facility.associatedCoaches.map(id=>id.toString()))){
                 facility.associatedCoaches = newCoachIds;
                 coachesModified = true;
                 console.log("[Admin Update Facility] Updating associatedCoaches:", facility.associatedCoaches);
             }
        } catch (castError) {
            console.error("Error casting associatedCoaches:", castError);
            res.status(400); throw new Error('Invalid ObjectId format provided for associatedCoaches.');
        }
    }
    // --- End associatedCoaches Handling ---

    // --- Image Handling ---
    let oldImagePaths = []; let imagesUpdated = false;
    const shouldClearImages = String(clearImages) === 'true';
    if (shouldClearImages) { console.log("[Admin Update Facility] Clearing existing images flag received."); oldImagePaths = [...facility.images]; facility.images = []; imagesUpdated = true; }
    if (req.files && req.files.length > 0) { console.log(`[Admin Update Facility] ${req.files.length} new images uploaded.`); if (!shouldClearImages) { oldImagePaths = [...facility.images]; } const newImagePaths = req.files.map(file => file.filename ? `/uploads/facilities/${file.filename}` : null).filter(Boolean); if (newImagePaths.length > 0) { facility.images = newImagePaths; imagesUpdated = true; console.log("[Admin Update Facility] New image paths set:", facility.images); } else { console.warn("[Admin Update Facility] Uploaded files were missing filenames."); req.files.forEach(file => safeUnlink(file.path, 'temp upload with missing filename')); } }
    // --- End Image Handling ---

    // --- Save changes ---
    try {
        // Mark modified paths for Mongoose - crucial for arrays/nested
        if (imagesUpdated) facility.markModified('images');
        if (coachesModified) facility.markModified('associatedCoaches');
        if (operatingHoursModified) facility.markModified('operatingHours'); // Mark hours as modified

        const updatedFacility = await facility.save();

        // Delete old images AFTER successful save
        if (imagesUpdated && oldImagePaths.length > 0) { console.log(`[Admin Update Facility] Attempting to delete ${oldImagePaths.length} old images.`); oldImagePaths.forEach(oldPath => { if (oldPath && !oldPath.includes('placeholder') && oldPath.startsWith('/uploads/')) safeUnlink(oldPath, 'old facility image'); }); }

        console.log(`[Admin] Facility ${facilityId} updated successfully by admin ${req.user.id}.`);
        res.status(200).json(updatedFacility);
    } catch (error) {
        console.error(`[Admin Update Facility] Error saving updated facility ${facilityId}:`, error); if (imagesUpdated && req.files && req.files.length > 0) { console.log("[Admin Update Facility] Rolling back: deleting newly uploaded files due to save error."); req.files.forEach(file => safeUnlink(file.path, 'new upload')); }
        res.status(500);
         if (error.name === 'ValidationError') {
            throw new Error(`Facility validation failed: ${error.message}`);
         } else {
            throw new Error('Failed to update facility due to a server error.');
         }
    }
});
const deleteFacilityByAdmin = asyncHandler(async (req, res) => {
    const facilityId = req.params.id; console.log(`[Admin] Attempting delete for facility ID: ${facilityId}`); if (!mongoose.Types.ObjectId.isValid(facilityId)) { res.status(400); throw new Error('Invalid Facility ID format'); } const facility = await Facility.findById(facilityId); if (!facility) { res.status(404); throw new Error('Facility not found'); } const imagePaths = facility.images; const result = await Facility.deleteOne({ _id: facilityId }); if (result.deletedCount === 0) { res.status(404); throw new Error('Facility not found during delete operation.'); } if (imagePaths && imagePaths.length > 0) { console.log(`[Admin] Attempting to delete ${imagePaths.length} images for facility ${facilityId}`); imagePaths.forEach(imagePath => { if (imagePath && !imagePath.includes('placeholder') && imagePath.startsWith('/uploads/')) safeUnlink(imagePath, 'facility image'); }); } console.log(`[Admin] Facility ${facilityId} deleted successfully by admin ${req.user.id}.`); res.status(200).json({ message: 'Facility deleted successfully' });
});

// ==============================
// Trainer Management Functions
// ==============================
const getAllAdminTrainers = asyncHandler(async (req, res) => {
    console.log('[Admin] Fetching all trainers'); try { const trainers = await Trainer.find({}).sort({ name: 1 }).select('name specialization location hourlyRate rating isActive profileImage createdAt').lean(); console.log(`[Admin] Found ${trainers.length} trainers.`); res.status(200).json({ trainers }); } catch (error) { console.error("[Admin] Error fetching trainers:", error); res.status(500); throw new Error("Server error fetching trainers."); }
});
const getAdminTrainerById = asyncHandler(async (req, res) => {
    const trainerId = req.params.id; console.log(`[Admin] Getting trainer by ID: ${trainerId}`); if (!mongoose.Types.ObjectId.isValid(trainerId)) { res.status(400); throw new Error('Invalid Trainer ID format'); } const trainer = await Trainer.findById(trainerId).populate('associatedFacilities', 'name'); if (trainer) { res.status(200).json(trainer); } else { res.status(404); throw new Error('Trainer not found'); }
});
const createTrainerByAdmin = asyncHandler(async (req, res) => {
    console.log("[Admin Create Trainer] Body:", req.body); console.log("[Admin Create Trainer] File:", req.file); if (!req.body) { if (req.file) safeUnlink(req.file.path, 'temp upload'); res.status(400); throw new Error("Request body is missing."); } if (req.fileValidationError) { res.status(400); throw new Error(req.fileValidationError.message); } const { name, specialization, sports, location, hourlyRate, experienceYears, bio, languages, availability, isActive } = req.body; if (!name || !specialization || !sports || !location || !hourlyRate || !experienceYears || !bio) { if (req.file) safeUnlink(req.file.path, 'temp upload'); res.status(400); throw new Error('Missing required fields'); } const parsedSports = typeof sports === 'string' ? sports.split(',').map(s => s.trim()).filter(Boolean) : []; const parsedLanguages = typeof languages === 'string' ? languages.split(',').map(l => l.trim()).filter(Boolean) : []; const parsedAvailability = typeof availability === 'string' ? availability.split(',').map(a => a.trim()).filter(Boolean) : []; let imagePath = '/images/default-trainer.png'; if (req.file && req.file.filename) { imagePath = `/uploads/trainers/${req.file.filename}`; console.log(`[Admin Create Trainer] Using uploaded image path: ${imagePath}`); } else { console.log(`[Admin Create Trainer] No valid file/filename, using default.`); if (req.file?.path) safeUnlink(req.file.path, 'temp upload with missing filename');} const trainerData = { name, specialization, sports: parsedSports, location, hourlyRate: Number(hourlyRate), experienceYears: Number(experienceYears), bio, languages: parsedLanguages, availability: parsedAvailability, profileImage: imagePath, isActive: String(isActive) === 'true' }; try { const createdTrainer = await Trainer.create(trainerData); console.log(`[Admin] Trainer ${createdTrainer._id} created successfully.`); res.status(201).json(createdTrainer); } catch (error) { console.error("[Admin Create Trainer] Error saving trainer:", error); if (req.file?.path) safeUnlink(req.file.path, 'temp upload'); res.status(500); if (error.name === 'ValidationError') { throw new Error(`Trainer validation failed: ${error.message}`); } throw new Error('Failed to create trainer.'); }
});
const updateTrainerByAdmin = asyncHandler(async (req, res) => {
    const trainerId = req.params.id; console.log(`[Admin Update Trainer] ID: ${trainerId}`); console.log("[Admin Update Trainer] Body:", req.body); console.log("[Admin Update Trainer] File:", req.file); if (!req.body) { if (req.file) safeUnlink(req.file.path, 'temp upload'); res.status(400); throw new Error("Request body is missing."); } if (!mongoose.Types.ObjectId.isValid(trainerId)) { res.status(400); throw new Error('Invalid Trainer ID format'); } const trainer = await Trainer.findById(trainerId); if (!trainer) { if (req.file) safeUnlink(req.file.path, 'temp upload'); res.status(404); throw new Error('Trainer not found'); } if (req.fileValidationError) { res.status(400); throw new Error(req.fileValidationError.message); } const { name, specialization, sports, location, hourlyRate, experienceYears, bio, languages, availability, isActive } = req.body; let hasChanges = false; if (name !== undefined && name !== trainer.name) { trainer.name = name; hasChanges = true; } if (specialization !== undefined && specialization !== trainer.specialization) { trainer.specialization = specialization; hasChanges = true; } if (location !== undefined && location !== trainer.location) { trainer.location = location; hasChanges = true; } if (hourlyRate !== undefined && Number(hourlyRate) !== trainer.hourlyRate) { trainer.hourlyRate = Number(hourlyRate); hasChanges = true; } if (experienceYears !== undefined && Number(experienceYears) !== trainer.experienceYears) { trainer.experienceYears = Number(experienceYears); hasChanges = true; } if (bio !== undefined && bio !== trainer.bio) { trainer.bio = bio; hasChanges = true; } if (isActive !== undefined && (String(isActive) === 'true') !== trainer.isActive) { trainer.isActive = String(isActive) === 'true'; hasChanges = true; } if (sports !== undefined) { const newSports = typeof sports === 'string' ? sports.split(',').map(s => s.trim()).filter(Boolean) : []; if (JSON.stringify(newSports) !== JSON.stringify(trainer.sports)) { trainer.sports = newSports; hasChanges = true; } } if (languages !== undefined) { const newLanguages = typeof languages === 'string' ? languages.split(',').map(l => l.trim()).filter(Boolean) : []; if (JSON.stringify(newLanguages) !== JSON.stringify(trainer.languages)) { trainer.languages = newLanguages; hasChanges = true; } } if (availability !== undefined) { const newAvailability = typeof availability === 'string' ? availability.split(',').map(a => a.trim()).filter(Boolean) : []; if (JSON.stringify(newAvailability) !== JSON.stringify(trainer.availability)) { trainer.availability = newAvailability; hasChanges = true; } } let oldImagePath = null; let imageUpdated = false; let newImagePath = null; if (req.file && req.file.filename) { console.log("[Admin Update Trainer] New file:", req.file.filename); newImagePath = `/uploads/trainers/${req.file.filename}`; if (newImagePath !== trainer.profileImage) { oldImagePath = trainer.profileImage; trainer.profileImage = newImagePath; imageUpdated = true; hasChanges = true; console.log(`[Admin Update Trainer] profileImage updated to: ${trainer.profileImage}`); } else { console.log("[Admin Update Trainer] Same image path. Deleting redundant upload."); safeUnlink(req.file.path, 'redundant new upload'); } } else if (req.file) { console.warn(`[Admin Update Trainer] File exists but no filename. Deleting temp: ${req.file.path}`); safeUnlink(req.file.path, 'temp upload with missing filename');} if (hasChanges) { console.log("[Admin Update Trainer] Changes detected. Saving..."); try { if (imageUpdated) { trainer.markModified('profileImage'); console.log("Marked 'profileImage' as modified."); } const updatedTrainer = await trainer.save(); console.log(`[Admin Update Trainer] Save successful: ${updatedTrainer._id}`); if (imageUpdated && oldImagePath && oldImagePath !== '/images/default-trainer.png' && oldImagePath.startsWith('/uploads/')) { safeUnlink(oldImagePath, 'old trainer image'); } res.status(200).json(updatedTrainer); } catch (error) { console.error(`[Admin Update Trainer] Error saving ${trainerId}:`, error); if (imageUpdated && req.file) { safeUnlink(req.file.path, 'new upload'); } res.status(500); throw new Error('Failed to update trainer.'); } } else { console.log("[Admin Update Trainer] No changes detected."); if (req.file) { safeUnlink(req.file.path, 'new upload'); } res.status(200).json(trainer); }
});
const deleteTrainerByAdmin = asyncHandler(async (req, res) => {
     const trainerId = req.params.id; console.log(`[Admin] Attempting delete for trainer ID: ${trainerId}`); if (!mongoose.Types.ObjectId.isValid(trainerId)) { res.status(400); throw new Error('Invalid Trainer ID format'); } const trainer = await Trainer.findById(trainerId); if (!trainer) { res.status(404); throw new Error('Trainer not found'); } const imagePath = trainer.profileImage; const result = await Trainer.deleteOne({ _id: trainerId }); if (result.deletedCount === 0) { res.status(404); throw new Error('Trainer not found during delete.'); } if (imagePath && imagePath !== '/images/default-trainer.png' && imagePath.startsWith('/uploads/')) { safeUnlink(imagePath, 'trainer image'); } console.log(`[Admin] Trainer ${trainerId} deleted successfully.`); res.status(200).json({ message: 'Trainer deleted successfully' });
});

// ==============================
// Booking Management Functions
// ==============================
const getAllAdminBookings = asyncHandler(async (req, res) => {
    console.log('[Admin] Fetching all bookings'); const page = Number(req.query.page) || 1; const limit = Number(req.query.limit) || 15; const skip = (page - 1) * limit; const queryFilter = {}; if (req.query.status && ['upcoming', 'completed', 'cancelled', 'no-show'].includes(req.query.status)) { queryFilter.status = req.query.status; } if (req.query.paymentStatus && ['pending', 'paid', 'failed', 'refunded'].includes(req.query.paymentStatus)) { queryFilter.paymentStatus = req.query.paymentStatus; } if (req.query.bookingType && ['facility', 'trainer'].includes(req.query.bookingType)) { queryFilter.bookingType = req.query.bookingType; } if (req.query.search) { const keywordRegex = { $regex: req.query.search, $options: 'i' }; queryFilter.$or = [ { bookingId: keywordRegex } ]; console.warn("[Admin Bookings] Search filter applied to bookingId only."); } console.log('[Admin Bookings] Query Filter:', queryFilter); try { const count = await Booking.countDocuments(queryFilter); const bookings = await Booking.find(queryFilter).populate('user', 'name email').populate('facility', 'name').populate('trainer', 'name').sort({ createdAt: -1 }).limit(limit).skip(skip).lean(); console.log(`[Admin] Found ${bookings.length} bookings for page ${page}. Total count: ${count}`); res.status(200).json({ bookings, page, pages: Math.ceil(count / limit), count }); } catch (error) { console.error("[Admin] Error fetching bookings:", error); res.status(500); throw new Error("Server error fetching bookings."); }
});
const updateBookingStatusByAdmin = asyncHandler(async (req, res) => {
    const bookingId = req.params.id;
    const { status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(bookingId)) { res.status(400); throw new Error('Invalid Booking ID format'); }
    if (!status || !['upcoming', 'completed', 'cancelled', 'no-show'].includes(status)) { res.status(400); throw new Error('Invalid or missing status value'); }

    // Populate user and details for notification
    const booking = await Booking.findById(bookingId)
                                 .populate('user', '_id name email') // Need user ID
                                 .populate('facility', 'name')
                                 .populate('trainer', 'name');

    if (!booking) { res.status(404); throw new Error('Booking not found'); }

    const oldStatus = booking.status; // Get old status before changing
    booking.status = status;
    const updatedBooking = await booking.save();
    console.log(`[Admin] Booking ${bookingId} status updated to ${status} by admin ${req.user.id}`);

    // --- Send Notification ---
    if (oldStatus !== status && booking.user) { // Send only if status changed & user exists
        const userIdToNotify = booking.user._id;
        const formattedDate = format(updatedBooking.date, 'MMM d, yyyy');
        let targetName = 'your booking';
        if (booking.bookingType === 'facility' && booking.facility) targetName = `booking for ${booking.facility.name}`;
        else if (booking.bookingType === 'trainer' && booking.trainer) targetName = `session with ${booking.trainer.name}`;

        let message = `Admin Update: The status of ${targetName} on ${formattedDate} at ${updatedBooking.timeSlot} has been updated to ${status}. (#${updatedBooking.bookingId})`;
        if (status === 'cancelled') {
            message = `Admin Update: ${targetName} on ${formattedDate} at ${updatedBooking.timeSlot} has been cancelled by administration. (#${updatedBooking.bookingId})`;
        } else if (status === 'completed') {
             message = `Admin Update: ${targetName} on ${formattedDate} at ${updatedBooking.timeSlot} has been marked as completed. (#${updatedBooking.bookingId})`;
        }

        await createNotification(
            userIdToNotify,
            'booking_status_update',
            message,
            {
                link: `/bookings/${updatedBooking._id}`,
                relatedBookingId: updatedBooking._id,
                relatedUser: req.user.id // ID of admin who made the change
            }
        );
        console.log(`[Admin] Booking status update notification sent to user ${userIdToNotify}.`);
    }
    // --- End Notification ---

    res.status(200).json(updatedBooking);
});
const deleteBookingByAdmin = asyncHandler(async (req, res) => {
    const bookingId = req.params.id; if (!mongoose.Types.ObjectId.isValid(bookingId)) { res.status(400); throw new Error('Invalid Booking ID format'); } const booking = await Booking.findById(bookingId); if (!booking) { res.status(404); throw new Error('Booking not found'); } await Booking.findByIdAndDelete(bookingId); console.log(`[Admin] Booking ${bookingId} deleted by admin ${req.user.id}`); res.status(200).json({ message: 'Booking deleted successfully' });
});

// ==============================
// Testimonial Management Functions
// ==============================
const getAllAdminTestimonials = asyncHandler(async (req, res) => {
    console.log('[Admin] Fetching all testimonials'); try { const testimonials = await Testimonial.find({}).sort({ createdAt: -1 }).lean(); console.log(`[Admin] Found ${testimonials.length} testimonials.`); res.status(200).json(testimonials); } catch (error) { console.error("[Admin] Error fetching testimonials:", error); res.status(500); throw new Error("Server error fetching testimonials."); }
});
const createAdminTestimonial = asyncHandler(async (req, res) => {
     console.log('[Admin Create Testimonial] Body:', req.body); console.log('[Admin Create Testimonial] File:', req.file); if (!req.body || !req.body.content || !req.body.author) { if (req.file?.path) safeUnlink(req.file.path, 'temp testimonial upload'); res.status(400); throw new Error('Content and Author are required.'); } if (req.fileValidationError) { res.status(400); throw new Error(req.fileValidationError.message); } const { content, author, role } = req.body; const isActive = String(req.body.isActive) === 'true'; let imagePath = undefined; if (req.file && req.file.filename) { imagePath = `/uploads/testimonials/${req.file.filename}`; console.log(`[Admin Create Testimonial] Using image path: ${imagePath}`); } else { console.log("[Admin Create Testimonial] No image uploaded."); if (req.file?.path) safeUnlink(req.file.path, 'temp upload with missing filename'); } const testimonialData = { content, author, role, isActive, imageUrl: imagePath }; try { const createdTestimonial = await Testimonial.create(testimonialData); console.log(`[Admin] Testimonial ${createdTestimonial._id} created.`); res.status(201).json(createdTestimonial); } catch (error) { console.error("[Admin Create Testimonial] Error saving:", error); if (imagePath?.startsWith('/uploads')) safeUnlink(req.file?.path, 'temp testimonial upload'); res.status(500); if (error.name === 'ValidationError') { throw new Error(`Validation failed: ${error.message}`); } throw new Error('Failed to create testimonial.'); }
});
const updateAdminTestimonial = asyncHandler(async (req, res) => {
    const testimonialId = req.params.id; console.log(`[Admin Update Testimonial] ID: ${testimonialId}`); console.log('[Admin Update Testimonial] Body:', req.body); console.log('[Admin Update Testimonial] File:', req.file); if (!mongoose.Types.ObjectId.isValid(testimonialId)) { res.status(400); throw new Error('Invalid Testimonial ID format'); } let testimonial = await Testimonial.findById(testimonialId); if (!testimonial) { if (req.file?.path) safeUnlink(req.file.path, 'temp testimonial upload'); res.status(404); throw new Error('Testimonial not found'); } if (req.fileValidationError) { res.status(400); throw new Error(req.fileValidationError.message); } const { content, author, role, isActive, clearImage } = req.body; testimonial.content = content ?? testimonial.content; testimonial.author = author ?? testimonial.author; testimonial.role = role !== undefined ? role : testimonial.role; if (isActive !== undefined) { testimonial.isActive = String(isActive) === 'true'; } let oldImagePath = testimonial.imageUrl; let imageUpdated = false; if (String(clearImage) === 'true' && !req.file) { console.log('[Admin Update Testimonial] Clearing existing image.'); testimonial.imageUrl = undefined; imageUpdated = true; } else if (req.file && req.file.filename) { console.log('[Admin Update Testimonial] New file uploaded, replacing image.'); testimonial.imageUrl = `/uploads/testimonials/${req.file.filename}`; imageUpdated = true; } else if (req.file) { console.warn(`[Admin Update Testimonial] req.file exists but filename missing. Deleting temp: ${req.file.path}`); safeUnlink(req.file.path, 'temp upload with missing filename'); }
    try {
        if (imageUpdated) testimonial.markModified('imageUrl'); const updatedTestimonial = await testimonial.save(); console.log(`[Admin] Testimonial ${testimonialId} updated.`); if (imageUpdated && oldImagePath && oldImagePath.startsWith('/uploads/')) { safeUnlink(oldImagePath, 'old testimonial image'); } res.status(200).json(updatedTestimonial);
    } catch (error) { console.error(`[Admin Update Testimonial] Error saving ${testimonialId}:`, error); if (imageUpdated && req.file?.path && testimonial.imageUrl?.startsWith('/uploads/')) { safeUnlink(req.file.path, 'new temp testimonial upload'); } res.status(500); if (error.name === 'ValidationError') { throw new Error(`Validation failed: ${error.message}`); } throw new Error('Failed to update testimonial.'); }
});
const deleteAdminTestimonial = asyncHandler(async (req, res) => {
    const testimonialId = req.params.id; console.log(`[Admin] Attempting delete for testimonial ID: ${testimonialId}`); if (!mongoose.Types.ObjectId.isValid(testimonialId)) { res.status(400); throw new Error('Invalid Testimonial ID format'); } const testimonial = await Testimonial.findById(testimonialId); if (!testimonial) { res.status(404); throw new Error('Testimonial not found'); } const imagePath = testimonial.imageUrl; const result = await Testimonial.deleteOne({ _id: testimonialId }); if (result.deletedCount === 0) { res.status(404); throw new Error('Testimonial not found during delete operation.'); } if (imagePath && imagePath.startsWith('/uploads/')) { safeUnlink(imagePath, 'testimonial image'); } console.log(`[Admin] Testimonial ${testimonialId} deleted successfully.`); res.status(200).json({ message: 'Testimonial deleted successfully' });
});

// ==============================
// Athlete Management Functions
// ==============================
const getAllAdminAthletes = asyncHandler(async (req, res) => {
    console.log('[Admin] Fetching all athletes'); try { const athletes = await Athlete.find({}).sort({ createdAt: -1 }).select('_id name sport location goalAmount raisedAmount isActive image isFeatured').lean(); console.log(`[Admin] Found ${athletes.length} athletes.`); res.status(200).json(athletes); } catch (error) { console.error("[Admin] Error fetching athletes:", error); res.status(500).json({ message: "Server error fetching athletes." }); }
});
const getAdminAthleteById = asyncHandler(async (req, res) => {
    const athleteId = req.params.id; console.log(`[Admin] Getting athlete by ID: ${athleteId}`); if (!mongoose.Types.ObjectId.isValid(athleteId)) { res.status(400); throw new Error('Invalid Athlete ID format'); } const athlete = await Athlete.findById(athleteId); if (athlete) { res.status(200).json(athlete); } else { res.status(404); throw new Error('Athlete not found'); }
});
const createAdminAthlete = asyncHandler(async (req, res) => {
    console.log("[Admin Create Athlete] Body:", req.body); console.log("[Admin Create Athlete] File:", req.file); if (req.fileValidationError) { res.status(400); throw new Error(req.fileValidationError.message); } if (!req.file) { res.status(400); throw new Error('Athlete image is required (field name: image)'); } const { name, age, sport, goalAmount, story, location, achievements, isActive, isFeatured } = req.body; if (!name || !age || !sport || !goalAmount || !story || !location) { safeUnlink(req.file.path, 'temp athlete upload'); res.status(400); throw new Error('Missing required fields'); } const imagePath = `/uploads/athletes/${req.file.filename}`; const parsedAchievements = typeof achievements === 'string' ? achievements.split(',').map(a => a.trim()).filter(Boolean) : []; try { const newAthlete = await Athlete.create({ name, age: Number(age), sport, goalAmount: Number(goalAmount), story, location, achievements: parsedAchievements, image: imagePath, isActive: String(isActive) === 'true', isFeatured: String(isFeatured) === 'true', raisedAmount: 0 }); console.log(`[Admin] Athlete ${newAthlete._id} created successfully.`); res.status(201).json(newAthlete); } catch (error) { console.error("[Admin Create Athlete] Error saving:", error); safeUnlink(req.file.path, 'temp athlete upload'); res.status(500); if (error.name === 'ValidationError') { throw new Error(`Athlete validation failed: ${error.message}`); } throw new Error('Failed to create athlete profile.'); }
});
const updateAdminAthlete = asyncHandler(async (req, res) => {
    const athleteId = req.params.id; console.log(`[Admin Update Athlete] ID: ${athleteId}`); console.log("[Admin Update Athlete] Body:", req.body); console.log("[Admin Update Athlete] File:", req.file); if (!mongoose.Types.ObjectId.isValid(athleteId)) { res.status(400); throw new Error('Invalid Athlete ID format'); } const athlete = await Athlete.findById(athleteId); if (!athlete) { if (req.file?.path) safeUnlink(req.file.path, 'temp athlete upload'); res.status(404); throw new Error('Athlete not found'); } if (req.fileValidationError) { res.status(400); throw new Error(req.fileValidationError.message); } const { name, age, sport, goalAmount, story, location, achievements, isActive, isFeatured } = req.body; athlete.name = name ?? athlete.name; athlete.age = age !== undefined ? Number(age) : athlete.age; athlete.sport = sport ?? athlete.sport; athlete.goalAmount = goalAmount !== undefined ? Number(goalAmount) : athlete.goalAmount; athlete.story = story ?? athlete.story; athlete.location = location ?? athlete.location; if (achievements !== undefined) { athlete.achievements = typeof achievements === 'string' ? achievements.split(',').map(a => a.trim()).filter(Boolean) : athlete.achievements; } if (isActive !== undefined) athlete.isActive = String(isActive) === 'true'; if (isFeatured !== undefined) athlete.isFeatured = String(isFeatured) === 'true'; let oldImagePath = athlete.image; let imageUpdated = false; if (req.file && req.file.filename) { const newImagePath = `/uploads/athletes/${req.file.filename}`; if (newImagePath !== oldImagePath) { athlete.image = newImagePath; imageUpdated = true; console.log(`[Admin Update Athlete] Image updated to: ${newImagePath}`); } else { safeUnlink(req.file.path, 'redundant temp athlete upload'); } } else if (req.file) { safeUnlink(req.file.path, 'temp upload with missing filename'); } try { const updatedAthlete = await athlete.save(); console.log(`[Admin] Athlete ${athleteId} updated successfully.`); if (imageUpdated && oldImagePath && oldImagePath.startsWith('/uploads/')) { safeUnlink(oldImagePath, 'old athlete image'); } res.status(200).json(updatedAthlete); } catch (error) { console.error(`[Admin Update Athlete] Error saving ${athleteId}:`, error); if (imageUpdated && req.file?.path && athlete.image.startsWith('/uploads/')) { safeUnlink(req.file.path, 'new temp athlete upload'); } res.status(500); if (error.name === 'ValidationError') { throw new Error(`Athlete validation failed: ${error.message}`); } throw new Error('Failed to update athlete profile.'); }
});
const deleteAdminAthlete = asyncHandler(async (req, res) => {
    const athleteId = req.params.id; console.log(`[Admin] Attempting delete for athlete ID: ${athleteId}`); if (!mongoose.Types.ObjectId.isValid(athleteId)) { res.status(400); throw new Error('Invalid Athlete ID format'); } const athlete = await Athlete.findById(athleteId); if (!athlete) { res.status(404); throw new Error('Athlete not found'); } const imagePath = athlete.image; const result = await Athlete.deleteOne({ _id: athleteId }); if (result.deletedCount === 0) { res.status(404); throw new Error('Athlete not found during delete operation.'); } if (imagePath && imagePath.startsWith('/uploads/')) { safeUnlink(imagePath, 'athlete image'); } console.log(`[Admin] Athlete ${athleteId} deleted successfully.`); res.status(200).json({ message: 'Athlete deleted successfully' });
});

// ==============================
// Donation Management Functions
// ==============================
const getAllAdminDonations = asyncHandler(async (req, res) => {
    console.log('[Admin] Fetching all donations'); const page = Number(req.query.page) || 1; const limit = Number(req.query.limit) || 20; const skip = (page - 1) * limit; const queryFilter = {}; try { const count = await Donation.countDocuments(queryFilter); const donations = await Donation.find(queryFilter) .populate('donorUser', 'name email').populate('athlete', 'name sport').sort({ createdAt: -1 }).limit(limit).skip(skip).lean(); console.log(`[Admin] Found ${donations.length} donations for page ${page}. Total count: ${count}`); res.status(200).json({ donations, page, pages: Math.ceil(count / limit), count }); } catch (error) { console.error("[Admin] Error fetching donations:", error); res.status(500).json({ message: "Server error fetching donations." }); }
});

// ==================================
// Financial Aid Management Functions
// ==================================
const getAllAdminAidApplications = asyncHandler(async (req, res) => {
    console.log('[Admin] Fetching all financial aid applications'); const page = Number(req.query.page) || 1; const limit = Number(req.query.limit) || 15; const skip = (page - 1) * limit; const queryFilter = {}; if (req.query.status && ['pending', 'approved', 'rejected', 'needs_info'].includes(req.query.status)) { queryFilter.status = req.query.status; } try { const count = await FinancialAidApplication.countDocuments(queryFilter); const applications = await FinancialAidApplication.find(queryFilter).populate('applicantUser', 'name email').select('applicantUser status submittedDate sportsInfo.primarySport financialNeed.requestedAmount createdAt').sort({ createdAt: -1 }).limit(limit).skip(skip).lean(); console.log(`[Admin] Found ${applications.length} aid applications for page ${page}. Total count: ${count}`); res.status(200).json({ applications, page, pages: Math.ceil(count / limit), count }); } catch (error) { console.error("[Admin] Error fetching aid applications:", error); res.status(500).json({ message: "Server error fetching financial aid applications." }); }
});
const getAdminAidApplicationById = asyncHandler(async (req, res) => {
    const applicationId = req.params.id; console.log(`[Admin] Getting financial aid application by ID: ${applicationId}`); if (!mongoose.Types.ObjectId.isValid(applicationId)) { res.status(400); throw new Error('Invalid Application ID format'); } const application = await FinancialAidApplication.findById(applicationId).populate('applicantUser', 'name email phone'); if (application) { res.status(200).json(application); } else { res.status(404); throw new Error('Financial aid application not found'); }
});
const updateAdminAidApplicationStatus = asyncHandler(async (req, res) => {
    const applicationId = req.params.id; console.log(`[Admin] Updating financial aid application ID: ${applicationId}`); console.log('[Admin Update Aid App] Body:', req.body); if (!mongoose.Types.ObjectId.isValid(applicationId)) { res.status(400); throw new Error('Invalid Application ID format'); }

    const application = await FinancialAidApplication.findById(applicationId)
                                                    .populate('applicantUser', '_id'); // Need applicant ID

    if (!application) { res.status(404); throw new Error('Financial aid application not found'); }

    const { status, approvedAmount, validUntil, adminNotes } = req.body;
    const allowedStatuses = ['pending', 'approved', 'rejected', 'needs_info'];
    if (status && !allowedStatuses.includes(status)) { res.status(400); throw new Error(`Invalid status value.`); }
    if (status === 'approved' && (approvedAmount === undefined || approvedAmount <= 0)) { res.status(400); throw new Error('Approved amount required.'); }
    if (status === 'approved' && !validUntil) { res.status(400); throw new Error('Expiry date required.'); }

    const oldStatus = application.status; // Get old status

    // --- Apply changes ---
    if (status) { application.status = status; application.reviewedDate = new Date(); if (status !== 'approved') { application.approvedAmount = undefined; application.validUntil = undefined; } }
    if (status === 'approved') { application.approvedAmount = Number(approvedAmount); if(validUntil) { try { application.validUntil = new Date(validUntil); } catch (e) { res.status(400); throw new Error('Invalid validUntil date format.'); } } }
    if (adminNotes !== undefined) { application.adminNotes = adminNotes; }
    // --- End Apply Changes ---

    try {
        const updatedApplication = await application.save();
        console.log(`[Admin] Financial Aid Application ${applicationId} updated by ${req.user.id}. New status: ${status}`);

        // --- Send Notification ---
        if (status && oldStatus !== status && application.applicantUser?._id) {
            const userIdToNotify = application.applicantUser._id;
            let message = `Your financial aid application status has been updated to ${status}.`;
            if (status === 'approved') {
                message = `Congratulations! Your financial aid application has been approved for ${formatCurrency(updatedApplication.approvedAmount)} until ${formatDate(updatedApplication.validUntil)}. Check your profile for details.`;
            } else if (status === 'rejected') {
                message = `We regret to inform you that your financial aid application has been rejected. Please review the admin notes (if any) in your application details.`;
            } else if (status === 'needs_info') {
                message = `Action Required: Your financial aid application requires additional information. Please check your application details and contact support if needed.`;
            }

            await createNotification(
                userIdToNotify,
                'financial_aid_update',
                message,
                {
                    link: `/profile/financial-aid`, // Link to user's aid section
                    relatedUser: req.user.id // Admin who reviewed
                }
            );
             console.log(`[Admin] Financial aid status update notification sent to user ${userIdToNotify}.`);
        }
        // --- End Notification ---

        res.status(200).json(updatedApplication);
    } catch (error) {
        console.error(`[Admin Update Aid App] Error saving ${applicationId}:`, error);
        res.status(500);
        if (error.name === 'ValidationError') {
             throw new Error(`Validation failed: ${error.message}`);
        }
        throw new Error('Failed to update application.');
    }
});

// --- Export All Functions ---
module.exports = {
    // User functions
    getAllUsers, updateUserByAdmin, deleteUserByAdmin,
    // Facility functions
    getAllAdminFacilities, getAdminFacilityById, updateFacilityByAdmin, deleteFacilityByAdmin,
    // Trainer functions
    getAllAdminTrainers, getAdminTrainerById, createTrainerByAdmin, updateTrainerByAdmin, deleteTrainerByAdmin,
    // Booking functions
    getAllAdminBookings, updateBookingStatusByAdmin, deleteBookingByAdmin,
    // Testimonial functions
    getAllAdminTestimonials, createAdminTestimonial, updateAdminTestimonial, deleteAdminTestimonial,
    // Athlete functions
    getAllAdminAthletes, getAdminAthleteById, createAdminAthlete, updateAdminAthlete, deleteAdminAthlete,
    // Donation functions
    getAllAdminDonations,
    // Financial Aid functions
    getAllAdminAidApplications, getAdminAidApplicationById, updateAdminAidApplicationStatus,
};
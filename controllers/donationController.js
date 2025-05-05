// controllers/donationController.js
const asyncHandler = require('express-async-handler');
const Donation = require('../models/Donation'); // Ensure this model exists
const Athlete = require('../models/Athlete');
const mongoose = require('mongoose');
const createNotification = require('../utils/createNotification'); // ADD THIS IMPORT
const { format } = require('date-fns'); // ADD THIS IMPORT (if not already present)

// Helper function to format currency (add if not present)
const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return 'N/A';
    return `Rs. ${amount.toLocaleString('en-LK')}`;
};


// @desc    Make a donation to an athlete (Simplified - No Payment Gateway)
// @route   POST /api/donations/athletes/:id/donate
// @access  Private (requires user login)
const makeDonation = asyncHandler(async (req, res) => {
    console.log(`--- [makeDonation - Simplified] Entered for Athlete ID: ${req.params.id} ---`);
    const athleteId = req.params.id;
    const userId = req.user._id; // From protect middleware

    // Extract data from request body
    const {
        amount,
        isAnonymous,
        donorName: providedDonorName, // Name provided in form if not anonymous
        donorEmail, // Email is required for potential receipt/contact
        message
    } = req.body;

    console.log("[makeDonation] Received Data:", req.body);

    // --- Validation ---
    if (!mongoose.Types.ObjectId.isValid(athleteId)) {
        res.status(400); throw new Error('Invalid Athlete ID format');
    }
    const donationAmount = Number(amount);
    if (isNaN(donationAmount) || donationAmount <= 0) {
        res.status(400); throw new Error('Invalid donation amount');
    }
     if (!donorEmail) { // Email is crucial even if anonymous
        res.status(400); throw new Error('Donor email is required');
    }
    if (!isAnonymous && !providedDonorName) {
        // If not anonymous, name should ideally be provided, but we can fallback to user's name
        console.warn("[makeDonation] Donor name not provided for non-anonymous donation. Will use user's profile name.");
    }

    // --- Find Athlete ---
    const athlete = await Athlete.findById(athleteId);
    if (!athlete || !athlete.isActive) {
        res.status(404); throw new Error('Active athlete campaign not found');
    }
    console.log(`[makeDonation] Found Athlete: ${athlete.name}`);

    // --- Determine Donor Name ---
    // Use provided name if not anonymous, otherwise use the logged-in user's name, or fallback to 'Anonymous'
    let finalDonorName = 'Anonymous';
    if (!isAnonymous) {
        finalDonorName = providedDonorName || req.user.name; // Use form name or profile name
    }

    // --- Create Donation Record ---
    const donationData = {
        donorUser: userId,
        athlete: athleteId,
        amount: donationAmount,
        isAnonymous: !!isAnonymous, // Ensure boolean
        donorNameSnapshot: finalDonorName, // Store the name used for this donation
        donorEmailSnapshot: donorEmail, // Store the email used
        message: message || undefined,
        paymentStatus: 'succeeded', // Simulate successful payment
        paymentGateway: 'manual_entry', // Indicate no real gateway used
        paymentIntentId: `manual_${Date.now()}` // Generate a simple mock ID
    };

    console.log("[makeDonation] Creating Donation document:", donationData);
    const donation = await Donation.create(donationData);
    console.log(`[makeDonation] Donation record created: ${donation._id}`);

    // --- Update Athlete's Raised Amount ---
    athlete.raisedAmount = (athlete.raisedAmount || 0) + donationAmount;
    console.log(`[makeDonation] Updating athlete ${athlete.name}'s raised amount to: ${athlete.raisedAmount}`);
    await athlete.save();
    console.log(`[makeDonation] Athlete ${athlete.name} updated successfully.`);

    // --- Send Notifications (NEW) ---
    try {
        // 1. Thank You Notification to Donor
        await createNotification(
            userId, // The donor user
            'donation_thankyou',
            `Thank you for your generous donation of ${formatCurrency(donation.amount)} to ${athlete.name}! Your support makes a difference.`,
            {
                link: `/donations/${athleteId}`, // Link to athlete's profile
                relatedAthleteId: athleteId,
                // relatedDonationId: donation._id // Optional
            }
        );
        console.log(`[makeDonation] Thank you notification sent to donor ${userId}.`);

        // 2. Notification to Athlete (if they have a linked user account)
        // We need to fetch the athlete again potentially with associatedUser populated
        // Or modify the initial fetch if the Athlete model has associatedUser
        // Assuming 'associatedUser' is NOT directly on Athlete model for now. Need to adjust if it is.
        // If athlete profiles are linked to Users, find the user associated with the athlete.
        // This part requires knowing how Athletes and Users are linked (if at all).
        // Placeholder logic:
        const athleteUser = await User.findOne({ /* criteria linking user to athlete */ }); // Replace with actual query
        if (athleteUser) {
             const athleteUserId = athleteUser._id;
             let donorDisplayName = donation.isAnonymous ? 'An anonymous donor' : finalDonorName;
             await createNotification(
                 athleteUserId,
                 'donation_received',
                 `Great news! ${donorDisplayName} just donated ${formatCurrency(donation.amount)} to your campaign. Keep up the great work!`,
                 {
                     link: `/profile/donations`, // Link to athlete's donation section (adjust if needed)
                     // relatedDonationId: donation._id, // Link the specific donation (add to Notification model if needed)
                     relatedUser: userId // The donor's user ID
                 }
             );
             console.log(`[makeDonation] Donation received notification sent to athlete's user account ${athleteUserId}.`);
        } else {
             console.log(`[makeDonation] Athlete ${athleteId} does not have a linked user account or link method unknown. Skipping athlete notification.`);
        }

    } catch (notificationError) {
        console.error("[makeDonation] Error sending notifications:", notificationError);
        // Log the error but don't fail the main donation response
    }
    // --- End Send Notifications ---


    // --- Respond ---
    res.status(201).json({
        message: 'Donation recorded successfully!',
        donationId: donation._id,
        athleteId: athleteId,
        raisedAmount: athlete.raisedAmount, // Send back updated amount
        goalAmount: athlete.goalAmount,
    });
});

// --- Keep getSuccessStories ---
const getSuccessStories = asyncHandler(async (req, res) => {
    const successStories = await Athlete.find({
        isActive: true,
        $expr: { $gte: ["$raisedAmount", "$goalAmount"] }
    }).limit(10).sort({ updatedAt: -1 });
    res.status(200).json(successStories);
});


module.exports = {
    makeDonation,
    getSuccessStories,
};
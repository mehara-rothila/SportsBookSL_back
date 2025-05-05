// controllers/financialAidController.js
const asyncHandler = require('express-async-handler');
const FinancialAidApplication = require('../models/FinancialAidApplication');
const User = require('../models/User');
const mongoose = require('mongoose');
const fs = require('fs'); // Import fs for file cleanup

// @desc    Submit a financial aid application
// @route   POST /api/financial-aid/apply
// @access  Private
const submitApplication = asyncHandler(async (req, res) => {
    console.log('--- [submitApplication /apply] Entered ---');
    console.log('[submitApplication /apply] Received Body:', JSON.stringify(req.body, null, 2));
    console.log('[submitApplication /apply] Received Files:', req.files);
    console.log('[submitApplication /apply] req.user:', req.user);

    // **** USE ACTUAL USER ID FROM PROTECT MIDDLEWARE ****
    const userId = req.user?._id;
    if (!userId) {
        // This should technically not be reached if protect runs correctly, but good safeguard
        console.error("Validation Failed: User not authenticated (req.user._id missing after protect middleware)");
        // Clean up uploaded files if they exist
        if (req.files && req.files.length > 0) {
             req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error(`Error deleting uploaded file ${file.path} after auth error:`, err);
                });
            });
        }
        res.status(401);
        throw new Error('User not authenticated');
    }

    // --- Data Extraction from req.body ---
    const body = req.body || {};
    
    // Handle both nested objects and flattened key format
    let personalInfo, sportsInfo, financialNeed, reference, supportingInfo;
    
    // Check if we're receiving nested objects (as shown in logs)
    if (body.personalInfo && typeof body.personalInfo === 'object') {
        personalInfo = body.personalInfo;
        sportsInfo = body.sportsInfo || {};
        financialNeed = body.financialNeed || {};
        reference = body.reference || {};
        supportingInfo = body.supportingInfo || {};
    } else {
        // Fall back to the original extraction format
        personalInfo = {
            fullName: body['personalInfo[fullName]'],
            email: body['personalInfo[email]'],
            phone: body['personalInfo[phone]'],
            dateOfBirth: body['personalInfo[dateOfBirth]'],
            address: body['personalInfo[address]'],
            city: body['personalInfo[city]'],
            postalCode: body['personalInfo[postalCode]'],
        };
        
        sportsInfo = {
            primarySportId: body['sportsInfo[primarySport]'],
            skillLevelId: body['sportsInfo[skillLevel]'],
            yearsExperience: body['sportsInfo[yearsExperience]'],
            currentAffiliation: body['sportsInfo[currentAffiliation]'],
            achievementsDesc: body['sportsInfo[achievements]'],
        };
        
        financialNeed = {
            description: body['financialNeed[description]'],
            requestedAmountStr: body['financialNeed[requestedAmount]'],
            facilitiesNeededRaw: body['financialNeed[facilitiesNeeded]'] || body['financialNeed[facilitiesNeeded][]'],
            monthlyUsage: body['financialNeed[monthlyUsage]'],
        };
        
        reference = {
            refName: body['reference[name]'],
            refRelationship: body['reference[relationship]'],
            refContactInfo: body['reference[contactInfo]'],
            refOrganizationName: body['reference[organizationName]'],
        };
        
        supportingInfo = {
            previousAid: body['supportingInfo[previousAid]'],
            otherPrograms: body['supportingInfo[otherPrograms]'],
            additionalInfo: body['supportingInfo[additionalInfo]'],
        };
    }
    
    const terms = body.terms; // Extract terms

    // --- Handle special case for primarySport and skillLevel which might be objects ---
    const primarySportId = typeof sportsInfo.primarySport === 'object' ? 
        sportsInfo.primarySport?.id : 
        (sportsInfo.primarySportId || sportsInfo.primarySport);
        
    const skillLevelId = typeof sportsInfo.skillLevel === 'object' ? 
        sportsInfo.skillLevel?.id : 
        (sportsInfo.skillLevelId || sportsInfo.skillLevel);
    
    // --- Process facilitiesNeeded into a guaranteed array ---
    let facilitiesNeededArray = [];
    const facilitiesNeededRaw = financialNeed.facilitiesNeededRaw || financialNeed.facilitiesNeeded;
    console.log("Raw facilitiesNeededRaw from body:", facilitiesNeededRaw);
    
    if (facilitiesNeededRaw) {
        facilitiesNeededArray = Array.isArray(facilitiesNeededRaw)
            ? facilitiesNeededRaw
            : [facilitiesNeededRaw];
    }
    facilitiesNeededArray = facilitiesNeededArray.filter(Boolean);
    console.log("Processed facilitiesNeededArray:", facilitiesNeededArray);

    // **** ADD LOGGING RIGHT BEFORE VALIDATION ****
    console.log('--- [/apply] Data Before Validation ---');
    console.log('Extracted personalInfo:', JSON.stringify(personalInfo, null, 2));
    console.log('Extracted sportsInfo:', JSON.stringify({
        ...sportsInfo,
        primarySportId,
        skillLevelId
    }, null, 2));
    console.log('Extracted financialNeed:', JSON.stringify(financialNeed, null, 2));
    console.log('Extracted reference:', JSON.stringify(reference, null, 2));
    console.log('Extracted supportingInfo:', JSON.stringify(supportingInfo, null, 2));
    console.log('Extracted terms:', terms, `(Type: ${typeof terms})`); // Log type too
    console.log('Files length:', req.files?.length);
    console.log('--- [/apply] End Data Before Validation ---');

    // --- Backend Validation ---
    const validationErrors = [];
    if (!personalInfo.fullName) validationErrors.push('Full Name');
    if (!personalInfo.email) validationErrors.push('Email');
    if (!personalInfo.phone) validationErrors.push('Phone');
    if (!personalInfo.dateOfBirth) validationErrors.push('Date of Birth');
    if (!personalInfo.address) validationErrors.push('Address');
    // No validation for City, Postal Code, Current Affiliation, Org Name, Supporting Info (assuming optional)

    if (!primarySportId) validationErrors.push('Primary Sport');
    if (!skillLevelId) validationErrors.push('Skill Level');
    if (!sportsInfo.yearsExperience) validationErrors.push('Years Experience');
    // Ensure achievementsDesc is truthy (not null, undefined, empty string, 0 etc.)
    if (!sportsInfo.achievements && !sportsInfo.achievementsDesc) validationErrors.push('Achievements Description');

    if (!financialNeed.description) validationErrors.push('Financial Need Description');
    if (!financialNeed.requestedAmount && !financialNeed.requestedAmountStr) validationErrors.push('Requested Amount');
    if (facilitiesNeededArray.length === 0) validationErrors.push('Facilities Needed (at least one)');
    if (!financialNeed.monthlyUsage) validationErrors.push('Monthly Usage');

    if (!(reference.name || reference.refName)) validationErrors.push('Reference Name');
    if (!(reference.relationship || reference.refRelationship)) validationErrors.push('Reference Relationship');
    if (!(reference.contactInfo || reference.refContactInfo)) validationErrors.push('Reference Contact Info');

    if (terms !== 'true' && terms !== true) validationErrors.push(`Terms Agreement (must be string 'true', received: ${terms})`); // More detailed error


    if (validationErrors.length > 0) {
        console.error('--- [/apply] Validation Failed ---');
        console.error('Missing or invalid fields:', validationErrors.join(', ')); // Crucial log
        console.error('Terms value received:', terms);
        console.error('Facilities Needed Array (at validation):', facilitiesNeededArray);

        // Clean up uploaded files if they exist
        if (req.files && req.files.length > 0) {
             req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error(`Error deleting uploaded file ${file.path} after validation error:`, err);
                });
            });
        }
        res.status(400);
        throw new Error(`Missing required fields: ${validationErrors.join(', ')}`);
    }

    // --- Process Uploaded Files ---
    let documentUrls = [];
    if (req.files && req.files.length > 0) {
        documentUrls = req.files.map(file => `/uploads/financial_aid_docs/${file.filename}`);
    } else {
        console.log("[/apply] No files were processed by Multer (req.files is empty or undefined).");
    }
    console.log('[/apply] Document URLs to save:', documentUrls);

    // --- Prepare Data for Model ---
    const applicationData = {
        applicantUser: userId, // Use the actual userId from protect middleware
        personalInfoSnapshot: {
            fullName: personalInfo.fullName,
            email: personalInfo.email,
            phone: personalInfo.phone,
            dateOfBirth: new Date(personalInfo.dateOfBirth), // Ensure date object
            address: personalInfo.address,
            city: personalInfo.city,
            postalCode: personalInfo.postalCode,
        },
        sportsInfo: {
            primarySport: primarySportId,
            skillLevel: skillLevelId,
            yearsExperience: Number(sportsInfo.yearsExperience),
            currentAffiliation: sportsInfo.currentAffiliation || undefined, // Ensure undefined if empty
            achievements: sportsInfo.achievements || sportsInfo.achievementsDesc, // Support both formats
        },
        financialNeed: {
            description: financialNeed.description,
            requestedAmount: Number(financialNeed.requestedAmount || financialNeed.requestedAmountStr),
            facilitiesNeeded: facilitiesNeededArray,
            monthlyUsage: financialNeed.monthlyUsage,
        },
        reference: {
            name: reference.name || reference.refName,
            relationship: reference.relationship || reference.refRelationship,
            contactInfo: reference.contactInfo || reference.refContactInfo,
            organizationName: reference.organizationName || reference.refOrganizationName || undefined, // Ensure undefined if empty
        },
        documentUrls: documentUrls.length > 0 ? documentUrls : undefined, // Ensure undefined if empty
        supportingInfo: {
            previousAid: supportingInfo.previousAid || undefined, // Ensure undefined if empty
            otherPrograms: supportingInfo.otherPrograms || undefined, // Ensure undefined if empty
            additionalInfo: supportingInfo.additionalInfo || undefined, // Ensure undefined if empty
        },
        status: 'pending',
        submittedDate: new Date(),
    };

    console.log('--- [/apply] Application Data Prepared for DB ---');
    console.log(JSON.stringify(applicationData, null, 2));
    console.log('--- [/apply] End Application Data ---');

    // --- Save to Database ---
    try {
        const newApplication = await FinancialAidApplication.create(applicationData);
        console.log('[/apply] Financial Aid Application created:', newApplication._id);
        res.status(201).json({
            message: 'Financial aid application submitted successfully!',
            applicationId: newApplication._id,
        });
    } catch (dbError) {
        console.error("[/apply] Database save error:", dbError);
        // Rollback: Delete uploaded files if DB save fails
        if (req.files && req.files.length > 0) {
             req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error(`Error deleting uploaded file ${file.path} after DB error:`, err);
                });
            });
        }
        res.status(500);
        if (dbError.name === 'ValidationError') {
             console.error("[/apply] Mongoose Validation Error Details:", dbError.errors);
             throw new Error(`Application data validation failed: ${dbError.message}`);
        }
        throw new Error('Failed to save application to database.');
    }
});

// --- Keep getUserApplications ---
const getUserApplications = asyncHandler(async (req, res) => {
    if (!req.user || !req.user.id) {
        res.status(401);
        throw new Error('Not authorized to view applications');
    }
    const applications = await FinancialAidApplication.find({ applicantUser: req.user.id })
        .sort({ submittedDate: -1 })
        .select('_id submittedDate status sportsInfo.primarySport'); // Select only summary fields
    res.status(200).json(applications);
});

// @desc    Get financial aid application details
// @route   GET /api/financial-aid/applications/:id
// @access  Private
const getApplicationDetails = asyncHandler(async (req, res) => {
    const applicationId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
        res.status(400);
        throw new Error('Invalid application ID format');
    }
    
    const application = await FinancialAidApplication.findById(applicationId);
    
    if (!application) {
        res.status(404);
        throw new Error('Application not found');
    }
    
    // Check if the requesting user is the applicant
    if (application.applicantUser.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to view this application');
    }
    
    res.status(200).json(application);
});

module.exports = {
    submitApplication,
    getUserApplications,
    getApplicationDetails,
};
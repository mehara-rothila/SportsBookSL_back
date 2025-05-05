// controllers/trainerApplicationController.js
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const TrainerApplication = require('../models/TrainerApplication');
const Trainer = require('../models/Trainer');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const createNotification = require('../utils/createNotification');
const sendEmail = require('../utils/sendEmail');

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

// @desc    Submit a new trainer application
// @route   POST /api/trainer-applications
// @access  Private
const submitTrainerApplication = asyncHandler(async (req, res) => {
  console.log('[submitTrainerApplication] Received request:', req.body);
  console.log('[submitTrainerApplication] File:', req.file);

  // Basic validation
  const {
    name, specialization, sports, location, hourlyRate, experienceYears, bio,
    languages, availability, certifications
  } = req.body;

  if (!name || !specialization || !sports || !location || !hourlyRate || !experienceYears || !bio) {
    if (req.file) safeUnlink(req.file.path, 'temp upload');
    res.status(400);
    throw new Error('Missing required fields');
  }

  // Check if user already has a pending application
  const existingApplication = await TrainerApplication.findOne({
    userId: req.user._id,
    status: 'pending'
  });

  if (existingApplication) {
    if (req.file) safeUnlink(req.file.path, 'temp upload');
    res.status(400);
    throw new Error('You already have a pending trainer application');
  }

  // Process arrays from comma-separated strings
  const processSports = typeof sports === 'string' ? sports.split(',').map(s => s.trim()).filter(Boolean) : sports;
  const processLanguages = typeof languages === 'string' ? languages.split(',').map(l => l.trim()).filter(Boolean) : languages;
  const processAvailability = typeof availability === 'string' ? availability.split(',').map(a => a.trim()).filter(Boolean) : availability;
  const processCertifications = typeof certifications === 'string' ? certifications.split(',').map(c => c.trim()).filter(Boolean) : certifications;

  // Set image path
  let imagePath = '/images/default-trainer.png';
  if (req.file && req.file.filename) {
    imagePath = `/uploads/trainers/${req.file.filename}`;
    console.log(`[submitTrainerApplication] Using uploaded image path: ${imagePath}`);
  } else {
    console.log(`[submitTrainerApplication] No valid file/filename, using default.`);
    if (req.file?.path) safeUnlink(req.file.path, 'temp upload with missing filename');
  }

  try {
    // Create application
    const applicationData = {
      userId: req.user._id,
      name,
      specialization,
      sports: processSports,
      location,
      hourlyRate: Number(hourlyRate),
      experienceYears: Number(experienceYears),
      bio,
      languages: processLanguages,
      availability: processAvailability,
      certifications: processCertifications,
      profileImage: imagePath,
      status: 'pending'
    };

    const newApplication = await TrainerApplication.create(applicationData);
    console.log(`[submitTrainerApplication] Created application: ${newApplication._id}`);

    // Send confirmation notification to user
    await createNotification(
      req.user._id,
      'trainer_application_submitted',
      'Your trainer application has been submitted and is pending review.',
      {
        link: `/profile/trainer-applications`,
        relatedUserId: req.user._id
      }
    );

    // Send notification to admins
    const admins = await User.find({ role: 'admin' }).select('_id');
    if (admins.length > 0) {
      for (const admin of admins) {
        await createNotification(
          admin._id,
          'new_trainer_application',
          `New trainer application received from ${name}. Please review.`,
          {
            link: `/admin/trainer-applications`,
            relatedUserId: req.user._id
          }
        );
      }
      console.log(`[submitTrainerApplication] Sent notifications to ${admins.length} admins`);
    }

    res.status(201).json(newApplication);
  } catch (error) {
    console.error('[submitTrainerApplication] Error:', error);
    if (req.file) safeUnlink(req.file.path, 'temp upload');
    res.status(500);
    throw new Error('Failed to submit trainer application');
  }
});

// @desc    Get user's trainer applications
// @route   GET /api/trainer-applications/user
// @access  Private
const getUserApplications = asyncHandler(async (req, res) => {
  const applications = await TrainerApplication.find({ userId: req.user._id })
    .sort({ createdAt: -1 });

  res.status(200).json({ applications });
});

// @desc    Get all trainer applications (admin)
// @route   GET /api/admin/trainer-applications
// @access  Private/Admin
const getAllApplications = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status && ['pending', 'approved', 'rejected'].includes(req.query.status)) {
    filter.status = req.query.status;
  }

  const total = await TrainerApplication.countDocuments(filter);
  const applications = await TrainerApplication.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'name email');

  res.status(200).json({
    applications,
    page,
    pages: Math.ceil(total / limit),
    total
  });
});

// @desc    Get application by ID (admin)
// @route   GET /api/admin/trainer-applications/:id
// @access  Private/Admin
const getApplicationById = asyncHandler(async (req, res) => {
  const applicationId = req.params.id;
  
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    res.status(400);
    throw new Error('Invalid Application ID format');
  }

  const application = await TrainerApplication.findById(applicationId)
    .populate('userId', 'name email avatar')
    .populate('reviewedBy', 'name');

  if (!application) {
    res.status(404);
    throw new Error('Application not found');
  }

  res.status(200).json(application);
});

// @desc    Approve a trainer application (admin)
// @route   PUT /api/admin/trainer-applications/:id/approve
// @access  Private/Admin
const approveApplication = asyncHandler(async (req, res) => {
  const applicationId = req.params.id;
  
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    res.status(400);
    throw new Error('Invalid Application ID format');
  }

  // Get application
  const application = await TrainerApplication.findById(applicationId)
    .populate('userId', 'name email _id');

  if (!application) {
    res.status(404);
    throw new Error('Application not found');
  }

  if (application.status !== 'pending') {
    res.status(400);
    throw new Error(`Application is already ${application.status}`);
  }

  // Get user
  const user = await User.findById(application.userId);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Create trainer profile
  try {
    const newTrainer = await Trainer.create({
      name: application.name,
      specialization: application.specialization,
      sports: application.sports,
      location: application.location,
      profileImage: application.profileImage,
      hourlyRate: application.hourlyRate,
      experienceYears: application.experienceYears,
      availability: application.availability,
      certifications: application.certifications,
      bio: application.bio,
      languages: application.languages,
      userAccount: user._id,
      isActive: true
    });

    console.log(`[approveApplication] Created trainer profile: ${newTrainer._id}`);

    // Update application
    application.status = 'approved';
    application.reviewedBy = req.user._id;
    application.reviewedDate = new Date();
    application.adminNotes = req.body.adminNotes || '';
    application.createdTrainer = newTrainer._id;
    await application.save();

    // Update user role
    user.role = 'trainer';
    await user.save();

    // Send notification to user
    await createNotification(
      user._id,
      'trainer_application_approved',
      `Your trainer application has been approved! You can now accept bookings as a trainer.`,
      {
        link: `/profile/trainer-applications`,
        relatedUserId: req.user._id
      }
    );

    // Send email notification
    try {
      await sendEmail({
        email: user.email,
        subject: 'Your Trainer Application has been Approved!',
        html: `
          <div style="font-family: sans-serif; line-height: 1.6;">
            <h1 style="color: #059669;">Congratulations!</h1>
            <p>Hi ${user.name},</p>
            <p>Your application to become a trainer on SportsBookSL has been <strong>approved</strong>!</p>
            <p>You can now receive bookings from users and your profile is visible in the trainers list.</p>
            ${application.adminNotes ? `<p><strong>Admin Note:</strong> ${application.adminNotes}</p>` : ''}
            <div style="margin: 25px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile/trainer-applications" style="display: inline-block; padding: 10px 15px; background-color: #059669; color: white; text-decoration: none; border-radius: 5px;">View Application Status</a>
            </div>
            <p>Thank you for joining our trainer team!</p>
            <p>The SportsBookSL Team</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('[approveApplication] Email error:', emailError);
      // Continue even if email fails
    }

    res.status(200).json(application);
  } catch (error) {
    console.error('[approveApplication] Error:', error);
    res.status(500);
    throw new Error('Failed to approve trainer application');
  }
});

// @desc    Reject a trainer application (admin)
// @route   PUT /api/admin/trainer-applications/:id/reject
// @access  Private/Admin
const rejectApplication = asyncHandler(async (req, res) => {
  const applicationId = req.params.id;
  
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    res.status(400);
    throw new Error('Invalid Application ID format');
  }

  // Validate rejection reason
  if (!req.body.adminNotes) {
    res.status(400);
    throw new Error('Rejection reason is required');
  }

  // Get application
  const application = await TrainerApplication.findById(applicationId)
    .populate('userId', 'name email _id');

  if (!application) {
    res.status(404);
    throw new Error('Application not found');
  }

  if (application.status !== 'pending') {
    res.status(400);
    throw new Error(`Application is already ${application.status}`);
  }

  // Update application
  application.status = 'rejected';
  application.reviewedBy = req.user._id;
  application.reviewedDate = new Date();
  application.adminNotes = req.body.adminNotes;
  await application.save();

  // Send notification to user
  await createNotification(
    application.userId._id,
    'trainer_application_rejected',
    `Your trainer application has been reviewed and was not approved. Please check the admin feedback for details.`,
    {
      link: `/profile/trainer-applications`,
      relatedUserId: req.user._id
    }
  );

  // Send email notification
  try {
    await sendEmail({
      email: application.userId.email,
      subject: 'Update on Your Trainer Application',
      html: `
        <div style="font-family: sans-serif; line-height: 1.6;">
          <h1 style="color: #DC2626;">Application Status Update</h1>
          <p>Hi ${application.userId.name},</p>
          <p>We regret to inform you that your application to become a trainer on SportsBookSL has not been approved at this time.</p>
          <div style="background-color: #FEF2F2; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Reason:</strong></p>
            <p>${application.adminNotes}</p>
          </div>
          <p>You can view the full details in your profile and may submit a new application addressing the feedback provided.</p>
          <div style="margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile/trainer-applications" style="display: inline-block; padding: 10px 15px; background-color: #4B5563; color: white; text-decoration: none; border-radius: 5px;">View Application Status</a>
          </div>
          <p>Thank you for your interest in becoming a trainer with us.</p>
          <p>The SportsBookSL Team</p>
        </div>
      `
    });
  } catch (emailError) {
    console.error('[rejectApplication] Email error:', emailError);
    // Continue even if email fails
  }

  res.status(200).json(application);
});

module.exports = {
  submitTrainerApplication,
  getUserApplications,
  getAllApplications,
  getApplicationById,
  approveApplication,
  rejectApplication
};
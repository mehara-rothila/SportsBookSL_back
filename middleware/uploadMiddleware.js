// sportsbook-sl-backend/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDirExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`[Multer EnsureDir] Created directory: ${dirPath}`);
    }
};

const createDiskStorage = (destinationPath, filenameFunction = null) => {
    const fullDestinationPath = path.join(__dirname, '..', 'public', destinationPath);
    try { 
        ensureDirExists(fullDestinationPath); 
    } catch (err) { 
        console.error(`[Multer EnsureDir] Failed to create directory ${fullDestinationPath}:`, err); 
    }

    return multer.diskStorage({
        destination: function (req, file, cb) {
            if (!fs.existsSync(fullDestinationPath)) {
                 console.error(`[Multer Storage] Destination directory ${fullDestinationPath} missing!`);
                 return cb(new Error(`Storage destination missing: ${fullDestinationPath}`), null);
            }
            cb(null, fullDestinationPath);
        },
        filename: filenameFunction || function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });
};

// Custom filename function for avatars to include user ID
const avatarFilenameFunction = function (req, file, cb) {
    if (!req.user || !req.user._id) {
        console.error('[Multer Avatar] No user ID found in request');
        return cb(new Error('User ID required for avatar upload'), null);
    }
    
    const userId = req.user._id.toString();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    // Create filename with user ID for easier tracking
    const filename = `avatar-${userId}-${uniqueSuffix}${fileExtension}`;
    console.log(`[Multer Avatar] Generated filename: ${filename}`);
    
    cb(null, filename);
};

const imageFileFilter = (req, file, cb) => {
    if (!file) { 
        console.warn('[Multer Filter] No file object received by filter.'); 
        return cb(null, true); 
    }
    
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) { 
        console.log(`[Multer Filter] Accepted image file: ${file.originalname} (${file.mimetype})`);
        return cb(null, true); 
    } else { 
        console.warn(`[Multer Filter] Invalid file type rejected: ${file.originalname} (${file.mimetype})`); 
        req.fileValidationError = new Error('Invalid file type. Only images (jpeg, jpg, png, gif, webp) are allowed.'); 
        cb(null, false); 
    }
};

const documentFileFilter = (req, file, cb) => {
    if (!file) { return cb(null, true); }
    const filetypes = /pdf|doc|docx/;
    const allowedMimeTypes = /application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);
    if (mimetype && extname) { return cb(null, true); } else { console.warn(`[Multer Filter] Invalid document type rejected: ${file.originalname} (${file.mimetype})`); req.fileValidationError = new Error('Invalid document type. Only PDF, DOC, DOCX are allowed.'); cb(null, false); }
};

const createUploader = (storage, fileFilter, fieldName, maxCount = 1, fileSize = 10 * 1024 * 1024) => {
    const upload = multer({ 
        storage: storage, 
        limits: { fileSize: fileSize }, // Default 10MB, but can be configured
        fileFilter: fileFilter 
    });
    
    const uploaderMiddleware = maxCount === 1 ? upload.single(fieldName) : upload.array(fieldName, maxCount);
    
    return (req, res, next) => {
        uploaderMiddleware(req, res, (err) => {
            if (req.fileValidationError) { 
                console.error('[Upload Middleware] File validation error:', req.fileValidationError.message); 
                return res.status(400).json({ message: req.fileValidationError.message }); 
            }
            
            if (err instanceof multer.MulterError) { 
                console.error('[Upload Middleware] Multer error:', err); 
                let message = `File upload error: ${err.message}`; 
                
                if (err.code === 'LIMIT_FILE_SIZE') { 
                    message = `File is too large. Maximum size is ${fileSize / (1024 * 1024)}MB.`; 
                }
                
                if (err.code === 'LIMIT_UNEXPECTED_FILE') { 
                    message = `Unexpected field name '${err.field}'. Check your form data.`; 
                }
                
                return res.status(400).json({ message }); 
            }
            
            if (err) { 
                console.error('[Upload Middleware] Unknown upload error:', err); 
                return res.status(500).json({ message: 'An unexpected error occurred during file upload.' }); 
            }
            
            // Log success info
            if (req.file) {
                console.log(`[Upload Middleware] Successfully uploaded file: ${req.file.originalname} -> ${req.file.filename}`);
            } else if (req.files && req.files.length > 0) {
                console.log(`[Upload Middleware] Successfully uploaded ${req.files.length} files`);
            }
            
            next();
        });
    };
};

// --- Define Storage Locations ---
const categoryStorage = createDiskStorage('/uploads/categories/');
const facilityStorage = createDiskStorage('/uploads/facilities/');
const testimonialStorage = createDiskStorage('/uploads/testimonials/');
const avatarStorage = createDiskStorage('/uploads/avatars/', avatarFilenameFunction); // Use custom filename function for avatars
const financialAidStorage = createDiskStorage('/uploads/financial_aid_docs/');
const trainerStorage = createDiskStorage('/uploads/trainers/');
const athleteStorage = createDiskStorage('/uploads/athletes/');

// --- Export Middleware Instances ---
module.exports = {
    uploadCategoryImage: createUploader(categoryStorage, imageFileFilter, 'imageSrc'),
    uploadFacilityImages: createUploader(facilityStorage, imageFileFilter, 'images', 10),
    uploadTestimonialImage: createUploader(testimonialStorage, imageFileFilter, 'imageUrl'),
    // For avatar uploads, limit size to 2MB
    uploadAvatar: createUploader(avatarStorage, imageFileFilter, 'avatar', 1, 2 * 1024 * 1024),
    uploadFinancialAidDocs: createUploader(financialAidStorage, documentFileFilter, 'documents', 5),
    uploadTrainerImage: createUploader(trainerStorage, imageFileFilter, 'profileImage'),
    uploadAthleteImage: createUploader(athleteStorage, imageFileFilter, 'image'),
    
    // Export helper functions for use in testing or other middleware
    helpers: {
        ensureDirExists,
        createDiskStorage,
        imageFileFilter,
        documentFileFilter
    }
};
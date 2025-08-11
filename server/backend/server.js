const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

let Event;
try {
    Event = require('./models/event.js');
    console.log('✅ Event model loaded successfully');
} catch (error) {
    console.error('❌ Could not load Event model:', error.message);
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for development
    crossOriginEmbedderPolicy: false
}));

// Replace the CORS and rate limiting section in your server.js with this:

// Rate limiting - UPDATED to be less aggressive
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Increased from 100 to 300 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Don't count successful requests against the limit for some endpoints
    skipSuccessfulRequests: false,
    // Add more specific error response
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.round(15 * 60) // 15 minutes in seconds
        });
    }
});
// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15, // Increased from 5 to 15 login attempts per windowMs
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true, // Don't count successful logins
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many login attempts from this IP, please try again later.',
            retryAfter: Math.round(15 * 60)
        });
    }
});

// Apply general rate limiting to all requests
app.use(limiter);
app.use(express.json());
app.use(cookieParser());

// CORS configuration - UPDATED to fix the issue
app.use(cors({
    origin: [
        'https://interparentsfrontend.onrender.com',
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
    optionsSuccessStatus: 200 // For legacy browser support
}));

// Add preflight handling for all routes
app.options('*', cors());
// Serve PDF files statically
app.use('/pdf', express.static(path.join(__dirname, 'pdf'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
        }
    }
}));

app.use('/assets', express.static(path.join(__dirname, 'assets')));

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/interparents', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['member', 'admin', 'executive'],
        default: 'member'
    },
    school: {
        type: String,
        required: true
    },
    position: {
        type: String,
        default: 'Parent Representative'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const communicationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    filename: {
        type: String,
        required: true,
        unique: true
    },
    originalName: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        enum: ['JTC', 'BOG', 'Policy', 'Report', 'Memo', 'Other'],
        default: 'Other'
    },
    publishDate: {
        type: Date,
        default: Date.now
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
const Communication = mongoose.model('Communication', communicationSchema);

// JWT Helper functions
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'interparents-secret-key-change-in-production',
        { expiresIn: '24h' }
    );
};

const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET || 'interparents-secret-key-change-in-production');
};

// REQUIRED Authentication middleware (for routes that need authentication)
const auth = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access denied. No token provided.' 
            });
        }

        const decoded = verifyToken(token);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user || !user.isActive) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token or user not active.' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid token.' 
        });
    }
};

// OPTIONAL Authentication middleware (allows both authenticated and non-authenticated access)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            // No token provided - continue as non-authenticated user
            req.user = null;
            return next();
        }

        const decoded = verifyToken(token);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user || !user.isActive) {
            // Invalid token - continue as non-authenticated user
            req.user = null;
            return next();
        }

        req.user = user;
        next();
    } catch (error) {
        // Token verification failed - continue as non-authenticated user
        req.user = null;
        next();
    }
};

const adminAuth = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'executive') {
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied. Admin or Executive privileges required.' 
        });
    }
    next();
};

// File upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'pdf');
        
        const fs = require('fs');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename while preserving extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'comm-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// ========== EVENTS ROUTES ==========
console.log('📅 Registering Events routes...');

// GET /api/events - Now accessible without authentication for public events
app.get('/api/events', optionalAuth, async (req, res) => {
    try {
        const userRole = req.user ? req.user.role : 'guest';
        const userEmail = req.user ? req.user.email : 'anonymous';
        
        console.log(`📅 GET /api/events called by: ${userEmail} (${userRole})`);
        
        const { startDate, endDate, type, month, year } = req.query;
        let query = {};
        
        // Filter by date range
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (month && year) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0);
            query.date = {
                $gte: start,
                $lte: end
            };
        }
        
        // Filter by event type
        if (type && type !== 'all') {
            query.type = type;
        }
        
        // Non-authenticated users and members only see public events
        if (!req.user || req.user.role === 'member') {
            query.isPublic = true;
        }
        
        console.log('Query filters:', query);
        console.log('User authenticated:', !!req.user);
        
        const events = await Event.find(query)
            .populate('createdBy', 'name email school')
            .sort({ date: 1, time: 1 });
        
        console.log(`Found ${events.length} events`);
        
        res.json({
            success: true,
            events: events.map(event => ({
                id: event._id,
                title: event.title,
                type: event.type,
                date: event.formattedDate || event.date.toISOString().split('T')[0],
                time: event.time,
                location: event.location,
                description: event.description,
                organizer: event.organizer,
                createdBy: event.createdBy ? {
                    name: event.createdBy.name,
                    school: event.createdBy.school,
                    // Don't expose email for privacy
                    id: event.createdBy._id
                } : null,
                isPublic: event.isPublic,
                canEdit: req.user ? (event.canEdit ? event.canEdit(req.user.id, req.user.role) : true) : false,
                createdAt: event.createdAt,
                updatedAt: event.updatedAt
            }))
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching events',
            error: error.message
        });
    }
});

// POST /api/events - Create new event
app.post('/api/events', [
    auth,
    body('title').notEmpty().withMessage('Title is required'),
    body('type').isIn(['meeting', 'webinar', 'conference', 'deadline']).withMessage('Invalid event type'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format')
], async (req, res) => {
    try {
        console.log(`📅 POST /api/events called by user: ${req.user.email} (${req.user.role})`);
        console.log('Request body:', req.body);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const { title, type, date, time, location, description, organizer, isPublic } = req.body;
        
        console.log('Creating event:', { title, type, date, time });
        
        const event = new Event({
            title,
            type,
            date: new Date(date),
            time,
            location,
            description,
            organizer,
            isPublic: isPublic !== false,
            createdBy: req.user.id,
            school: req.user.school
        });
        
        await event.save();
        await event.populate('createdBy', 'name email school');
        
        console.log(`✅ Event created successfully: ${event._id}`);
        
        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            event: {
                id: event._id,
                title: event.title,
                type: event.type,
                date: event.formattedDate || event.date.toISOString().split('T')[0],
                time: event.time,
                location: event.location,
                description: event.description,
                organizer: event.organizer,
                createdBy: event.createdBy,
                isPublic: event.isPublic,
                canEdit: true,
                createdAt: event.createdAt,
                updatedAt: event.updatedAt
            }
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating event',
            error: error.message
        });
    }
});

// PUT /api/events/:id - Update event
app.put('/api/events/:id', [
    auth,
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('type').optional().isIn(['meeting', 'webinar', 'conference', 'deadline']).withMessage('Invalid event type'),
    body('date').optional().isISO8601().withMessage('Valid date is required'),
    body('time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format')
], async (req, res) => {
    try {
        console.log(`📅 PUT /api/events/${req.params.id} called by user: ${req.user.email}`);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }
        
        // Check if user can edit - flexible permission check
        const canEdit = event.canEdit ? event.canEdit(req.user.id, req.user.role) : 
                        (req.user.role === 'admin' || req.user.role === 'executive' || 
                         event.createdBy.toString() === req.user.id.toString());
        
        if (!canEdit) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only edit your own events.'
            });
        }
        
        const { title, type, date, time, location, description, organizer, isPublic } = req.body;
        
        if (title !== undefined) event.title = title;
        if (type !== undefined) event.type = type;
        if (date !== undefined) event.date = new Date(date);
        if (time !== undefined) event.time = time;
        if (location !== undefined) event.location = location;
        if (description !== undefined) event.description = description;
        if (organizer !== undefined) event.organizer = organizer;
        if (isPublic !== undefined) event.isPublic = isPublic;
        
        await event.save();
        await event.populate('createdBy', 'name email school');
        
        console.log(`✅ Event updated successfully: ${event._id}`);
        
        res.json({
            success: true,
            message: 'Event updated successfully',
            event: {
                id: event._id,
                title: event.title,
                type: event.type,
                date: event.formattedDate || event.date.toISOString().split('T')[0],
                time: event.time,
                location: event.location,
                description: event.description,
                organizer: event.organizer,
                createdBy: event.createdBy,
                isPublic: event.isPublic,
                canEdit: event.canEdit ? event.canEdit(req.user.id, req.user.role) : true,
                createdAt: event.createdAt,
                updatedAt: event.updatedAt
            }
        });
    } catch (error) {
        console.error('Error updating event:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error while updating event'
        });
    }
});

// DELETE /api/events/:id - Delete event
app.delete('/api/events/:id', auth, async (req, res) => {
    try {
        console.log(`📅 DELETE /api/events/${req.params.id} called by user: ${req.user.email}`);
        
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }
        
        // Check if user can delete - flexible permission check
        const canEdit = event.canEdit ? event.canEdit(req.user.id, req.user.role) : 
                        (req.user.role === 'admin' || req.user.role === 'executive' || 
                         event.createdBy.toString() === req.user.id.toString());
        
        if (!canEdit) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only delete your own events.'
            });
        }
        
        await Event.findByIdAndDelete(req.params.id);
        
        console.log(`✅ Event deleted successfully: ${req.params.id}`);
        
        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting event:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error while deleting event'
        });
    }
});

console.log('✅ Events routes registered successfully');

// ========== AUTHENTICATION ROUTES ==========

// Add this route to your server.js file in the AUTHENTICATION ROUTES section

// PUT /api/auth/change-password - Change user password
app.put('/api/auth/change-password', [
    auth,
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
    body('confirmPassword').notEmpty().withMessage('Password confirmation is required')
], async (req, res) => {
    try {
        console.log(`🔒 Password change request from user: ${req.user.email}`);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Verify new password matches confirmation
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match'
            });
        }

        // Verify new password is different from current
        if (currentPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from current password'
            });
        }

        // Get user with password for verification
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            console.log(`❌ Invalid current password for user: ${req.user.email}`);
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Additional password strength validation
        const passwordRegex = {
            minLength: newPassword.length >= 6,
            hasLowercase: /[a-z]/.test(newPassword),
            hasUppercase: /[A-Z]/.test(newPassword),
            hasNumber: /\d/.test(newPassword)
        };

        const strengthScore = Object.values(passwordRegex).filter(Boolean).length;
        if (strengthScore < 2) {
            return res.status(400).json({
                success: false,
                message: 'Password does not meet minimum strength requirements'
            });
        }

        // Update password (will be hashed by pre-save middleware)
        user.password = newPassword;
        await user.save();

        console.log(`✅ Password changed successfully for user: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while changing password'
        });
    }
});

app.post('/api/auth/login', loginLimiter, [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user._id);

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,  
            sameSite: 'none',  
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                school: user.school,
                position: user.position
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({
        success: true,
        message: 'Logout successful'
    });
});

app.get('/api/auth/me', auth, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            school: req.user.school,
            position: req.user.position,
            lastLogin: req.user.lastLogin
        }
    });
});

// ========== COMMUNICATION MANAGEMENT ROUTES ==========

app.get('/api/communications', async (req, res) => {
    try {
        const communications = await Communication.find({ isActive: true })
            .populate('uploadedBy', 'name')
            .sort({ publishDate: -1 });
        
        res.json({
            success: true,
            communications
        });
    } catch (error) {
        console.error('Get communications error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

app.post('/api/communications', auth, adminAuth, upload.single('pdf'), [
    body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('category').isIn(['JTC', 'BOG', 'Policy', 'Report', 'Memo', 'Other']).withMessage('Invalid category')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.file) {
                await fs.unlink(req.file.path).catch(console.error);
            }
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: errors.array()
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'PDF file is required'
            });
        }

        const { title, description, category, publishDate } = req.body;

        const communication = new Communication({
            title,
            description,
            filename: req.file.filename,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            category,
            publishDate: publishDate ? new Date(publishDate) : new Date(),
            uploadedBy: req.user._id
        });

        await communication.save();
        await communication.populate('uploadedBy', 'name');

        res.status(201).json({
            success: true,
            message: 'Communication uploaded successfully',
            communication
        });

    } catch (error) {
        // Delete uploaded file if database save fails
        if (req.file) {
            await fs.unlink(req.file.path).catch(console.error);
        }
        console.error('Upload communication error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

app.put('/api/communications/:id', auth, adminAuth, [
    body('title').optional().trim().isLength({ min: 3 }),
    body('description').optional().trim().isLength({ min: 10 }),
    body('category').optional().isIn(['JTC', 'BOG', 'Policy', 'Report', 'Memo', 'Other'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: errors.array()
            });
        }

        const communication = await Communication.findById(req.params.id);
        if (!communication) {
            return res.status(404).json({
                success: false,
                message: 'Communication not found'
            });
        }

        const allowedUpdates = ['title', 'description', 'category', 'publishDate'];
        const updates = {};
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        Object.assign(communication, updates);
        await communication.save();
        await communication.populate('uploadedBy', 'name');

        res.json({
            success: true,
            message: 'Communication updated successfully',
            communication
        });

    } catch (error) {
        console.error('Update communication error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

app.delete('/api/communications/:id', auth, adminAuth, async (req, res) => {
    try {
        const communication = await Communication.findById(req.params.id);
        if (!communication) {
            return res.status(404).json({
                success: false,
                message: 'Communication not found'
            });
        }

        const filePath = path.join(__dirname, 'pdf', communication.filename);
        try {
            await fs.unlink(filePath);
        } catch (fileError) {
            console.error('Error deleting file:', fileError);
        }

        await Communication.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Communication deleted successfully'
        });

    } catch (error) {
        console.error('Delete communication error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ========== USER MANAGEMENT ROUTES ==========

app.get('/api/users', auth, adminAuth, async (req, res) => {
    try {
        const users = await User.find({ isActive: true }).select('-password');
        res.json({
            success: true,
            users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});


app.post('/api/users', auth, adminAuth, [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('confirmPassword').notEmpty().withMessage('Password confirmation is required'),
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('school').trim().isLength({ min: 2 }).withMessage('School must be at least 2 characters'),
    body('role').isIn(['member', 'executive', 'admin']).withMessage('Invalid role selected')
], async (req, res) => {
    try {
        console.log(`👤 User creation request from admin: ${req.user.email}`);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { email, password, confirmPassword, name, role, school, position } = req.body;

        // Enhanced password validation
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        // Password strength validation (matching frontend requirements)
        const passwordRequirements = {
            minLength: password.length >= 6,
            hasLowercase: /[a-z]/.test(password),
            hasUppercase: /[A-Z]/.test(password),
            hasNumber: /\d/.test(password)
        };

        const strengthScore = Object.values(passwordRequirements).filter(Boolean).length;
        const unmetRequirements = [];

        if (!passwordRequirements.minLength) unmetRequirements.push('at least 6 characters');
        if (!passwordRequirements.hasLowercase) unmetRequirements.push('at least one lowercase letter');
        if (!passwordRequirements.hasUppercase) unmetRequirements.push('at least one uppercase letter');
        if (!passwordRequirements.hasNumber) unmetRequirements.push('at least one number');

        if (strengthScore < 2) {
            return res.status(400).json({
                success: false,
                message: `Password does not meet minimum requirements. Missing: ${unmetRequirements.join(', ')}`
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email already exists'
            });
        }

        // Role validation - only admins can create other admins
        if (role === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can create admin accounts'
            });
        }

        // Create new user
        const user = new User({
            email,
            password, // Will be hashed by pre-save middleware
            name,
            role: role || 'member',
            school,
            position: position || 'Parent Representative'
        });

        await user.save();

        console.log(`✅ User created successfully: ${user.email} (${user.role}) by ${req.user.email}`);

        res.status(201).json({
            success: true,
            message: `User created successfully with ${strengthScore === 4 ? 'strong' : strengthScore === 3 ? 'good' : 'acceptable'} password security`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                school: user.school,
                position: user.position,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('Create user error:', error);
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error while creating user'
        });
    }
});

app.delete('/api/users/:id', auth, adminAuth, async (req, res) => {
    try {
        const userId = req.params.id;

        if (userId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await User.findByIdAndDelete(userId);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ========== UTILITY ROUTES ==========

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'INTERPARENTS API Server is running',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth/*',
            events: '/api/events',
            communications: '/api/communications',
            users: '/api/users'
        }
    });
});

// ========== ERROR HANDLING ==========

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 10MB.'
            });
        }
    }
    
    if (err.message === 'Only PDF files are allowed') {
        return res.status(400).json({
            success: false,
            message: 'Only PDF files are allowed'
        });
    }
    
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// ========== START SERVER ==========

const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
};

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
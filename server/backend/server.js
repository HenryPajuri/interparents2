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

console.log('🚀 Starting INTERPARENTS server...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', PORT);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true
});

// Middleware setup
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://interparentsfrontend.onrender.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Serve static files
app.use('/pdf', express.static(path.join(__dirname, 'pdf'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
        }
    }
}));

app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Database connection with retry logic
const connectDB = async (retries = 5) => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/interparents';
        console.log('Connecting to MongoDB...');
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ MongoDB connected successfully');
        return true;
    } catch (error) {
        console.error(`❌ MongoDB connection failed (attempt ${6 - retries}):`, error.message);
        
        if (retries > 1) {
            console.log(`Retrying in 5 seconds... (${retries - 1} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return connectDB(retries - 1);
        } else {
            console.error('Failed to connect to MongoDB after 5 attempts');
            throw error;
        }
    }
};

// ========== SCHEMAS AND MODELS ==========

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

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['meeting', 'webinar', 'conference', 'deadline'],
        default: 'meeting'
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: false
    },
    location: {
        type: String,
        required: false,
        trim: true
    },
    description: {
        type: String,
        required: false,
        trim: true
    },
    organizer: {
        type: String,
        required: false,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    school: {
        type: String,
        required: false
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    attendees: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['attending', 'not_attending', 'maybe'],
            default: 'attending'
        }
    }]
}, {
    timestamps: true
});

// Add indexes for better performance
eventSchema.index({ date: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ isPublic: 1 });

// Virtual for formatted date
eventSchema.virtual('formattedDate').get(function() {
    return this.date.toISOString().split('T')[0];
});

// Method to check if user can edit this event
eventSchema.methods.canEdit = function(userId, userRole) {
    if (userRole === 'admin' || userRole === 'executive') {
        return true;
    }
    return this.createdBy.toString() === userId.toString();
};

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

// Create models
const User = mongoose.model('User', userSchema);
const Communication = mongoose.model('Communication', communicationSchema);
const Event = mongoose.model('Event', eventSchema);

console.log('📋 Models created: User, Communication, Event');

// ========== JWT Helper functions ==========
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

// ========== MIDDLEWARE ==========
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
        console.error('Auth middleware error:', error);
        res.status(401).json({ 
            success: false, 
            message: 'Invalid token.' 
        });
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
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'comm-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
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

// ========== ROOT AND HEALTH ROUTES ==========

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'INTERPARENTS API Server is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/api/health',
            auth: '/api/auth/*',
            communications: '/api/communications',
            users: '/api/users',
            events: '/api/events'
        }
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        models: {
            User: !!User,
            Communication: !!Communication,
            Event: !!Event
        }
    });
});

// ========== AUTH ROUTES ==========

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
            maxAge: 24 * 60 * 60 * 1000
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

// ========== EVENTS ROUTES ==========

console.log('📅 Registering Events routes...');

// Get all events (with optional filtering)
app.get('/api/events', auth, async (req, res) => {
    try {
        console.log(`📅 GET /api/events called by user: ${req.user.email} (${req.user.role})`);
        
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
        
        // Non-admin users only see public events
        if (req.user.role === 'member') {
            query.isPublic = true;
        }
        
        console.log('Query filters:', query);
        
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
                date: event.formattedDate,
                time: event.time,
                location: event.location,
                description: event.description,
                organizer: event.organizer,
                createdBy: event.createdBy,
                isPublic: event.isPublic,
                canEdit: event.canEdit(req.user.id, req.user.role),
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

// Get single event
app.get('/api/events/:id', auth, async (req, res) => {
    try {
        console.log(`📅 GET /api/events/${req.params.id} called by user: ${req.user.email}`);
        
        const event = await Event.findById(req.params.id)
            .populate('createdBy', 'name email school');
        
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }
        
        // Check if user can view this event
        if (!event.isPublic && req.user.role === 'member' && event.createdBy._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        res.json({
            success: true,
            event: {
                id: event._id,
                title: event.title,
                type: event.type,
                date: event.formattedDate,
                time: event.time,
                location: event.location,
                description: event.description,
                organizer: event.organizer,
                createdBy: event.createdBy,
                isPublic: event.isPublic,
                canEdit: event.canEdit(req.user.id, req.user.role),
                createdAt: event.createdAt,
                updatedAt: event.updatedAt
            }
        });
    } catch (error) {
        console.error('Error fetching event:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error while fetching event'
        });
    }
});

// Create new event
app.post('/api/events', [
    auth,
    body('title').notEmpty().withMessage('Title is required'),
    body('type').isIn(['meeting', 'webinar', 'conference', 'deadline']).withMessage('Invalid event type'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format')
], async (req, res) => {
    try {
        console.log(`📅 POST /api/events called by user: ${req.user.email} (${req.user.role})`);
        
        // Check permissions
        if (req.user.role === 'member') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators and executives can create events'
            });
        }
        
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
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
                date: event.formattedDate,
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

// Update event
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
        
        if (!event.canEdit(req.user.id, req.user.role)) {
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
                date: event.formattedDate,
                time: event.time,
                location: event.location,
                description: event.description,
                organizer: event.organizer,
                createdBy: event.createdBy,
                isPublic: event.isPublic,
                canEdit: event.canEdit(req.user.id, req.user.role),
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

// Delete event
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
        
        if (!event.canEdit(req.user.id, req.user.role)) {
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

// ========== COMMUNICATION ROUTES ==========

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

// ========== USER ROUTES ==========

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
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').trim().isLength({ min: 2 }),
    body('school').trim().isLength({ min: 2 })
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

        const { email, password, name, role, school, position } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        const user = new User({
            email,
            password,
            name,
            role: role || 'member',
            school,
            position: position || 'Parent Representative'
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'User created successfully',
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
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
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

// ========== ERROR HANDLING ==========

app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    
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
    
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Catch-all 404 handler (MUST be last)
app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: 'Route not found',
        requestedPath: req.originalUrl,
        method: req.method
    });
});

// ========== START SERVER ==========

const startServer = async () => {
    try {
        console.log('🔄 Initializing server...');
        
        // Connect to database first
        await connectDB();
        
        // Test database connection
        const dbStats = await mongoose.connection.db.stats();
        console.log('📊 Database stats:', { 
            collections: dbStats.collections,
            dataSize: dbStats.dataSize 
        });
        
        // Count existing documents
        const userCount = await User.countDocuments();
        const eventCount = await Event.countDocuments();
        const commCount = await Communication.countDocuments();
        
        console.log('📋 Document counts:');
        console.log(`   Users: ${userCount}`);
        console.log(`   Events: ${eventCount}`);
        console.log(`   Communications: ${commCount}`);
        
        // Start server
        app.listen(PORT, () => {
            console.log('🚀 Server running successfully!');
            console.log(`   Port: ${PORT}`);
            console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   MongoDB: Connected`);
            console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'https://interparentsfrontend.onrender.com'}`);
            console.log('✅ All systems operational');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
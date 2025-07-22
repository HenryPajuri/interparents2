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

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Stricter rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login requests per windowMs
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true
});

app.use(limiter);
app.use(express.json());
app.use(cookieParser());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://interparentsfrontend.onrender.com',
    credentials: true
}));

// MongoDB connection
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

// User Schema
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

// Communication/PDF Schema
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

// Compare password method
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

// Authentication middleware
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

// Admin/Executive middleware
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
        cb(null, '/app/pdf/') // This will be the PDF directory in the container
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

// Routes

// Login route with fixed cookie settings for cross-origin
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

        // ✅ Fixed cookie settings for cross-origin requests
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,  // Always secure for cross-origin
            sameSite: 'none',  // Allow cross-origin cookies  
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Set cache control headers
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


// Logout route
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({
        success: true,
        message: 'Logout successful'
    });
});

// Get current user
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

// Get all communications (public - no auth required)
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

// Upload new communication (admin/executive only)
app.post('/api/communications', auth, adminAuth, upload.single('pdf'), [
    body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('category').isIn(['JTC', 'BOG', 'Policy', 'Report', 'Memo', 'Other']).withMessage('Invalid category')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Delete uploaded file if validation fails
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

// Update communication (admin/executive only)
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

// Delete communication (admin/executive only)
app.delete('/api/communications/:id', auth, adminAuth, async (req, res) => {
    try {
        const communication = await Communication.findById(req.params.id);
        if (!communication) {
            return res.status(404).json({
                success: false,
                message: 'Communication not found'
            });
        }

        // Delete the physical file
        const filePath = `/app/pdf/${communication.filename}`;
        try {
            await fs.unlink(filePath);
        } catch (fileError) {
            console.error('Error deleting file:', fileError);
            // Continue with database deletion even if file deletion fails
        }

        // Remove from database
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

// Get all users (admin only)
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

// Create new user (admin only)
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


// Delete user (admin/executive only)
app.delete('/api/users/:id', auth, adminAuth, async (req, res) => {
    try {
        const userId = req.params.id;

        // Prevent deleting yourself
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

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// ✅ CORRECT PLACE - Root route BEFORE error handling
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'INTERPARENTS API Server is running',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth/*',
            communications: '/api/communications',
            users: '/api/users'
        }
    });
});

// Error handling middleware
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


// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
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
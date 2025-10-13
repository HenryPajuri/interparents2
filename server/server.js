const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { uploadFile, deleteFile } = require('./utils/fileStorage');
require('dotenv').config();

const validateEnv = require('./config/validateEnv');
validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

const { supabase, getSupabaseAdmin } = require('./config/supabase');
const { auth, optionalAuth, adminAuth } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production'
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.round(15 * 60)
    });
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
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

app.use(limiter);
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL]
  : [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080'
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200
}));

app.options('*', cors());
app.get('/api/files/:filename', optionalAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const { download } = req.query;
    const filePath = path.join(__dirname, 'data/documents', filename);

    await fs.access(filePath);

    res.setHeader('Content-Type', 'application/pdf');
    if (download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }
    res.sendFile(filePath);
  } catch (error) {
    console.error('File access error:', error);
    res.status(404).json({
      success: false,
      message: 'File not found'
    });
  }
});

app.use('/api/images', express.static(path.join(__dirname, 'data/images')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'data/documents');
    const fsSync = require('fs');
    if (!fsSync.existsSync(uploadDir)) {
      fsSync.mkdirSync(uploadDir, { recursive: true });
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
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024
  }
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

console.log('Registering Events routes...');
app.get('/api/events', optionalAuth, async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : 'guest';
    const userEmail = req.user ? req.user.email : 'anonymous';

    console.log(`GET /api/events called by: ${userEmail} (${userRole})`);

    const { startDate, endDate, type, month, year } = req.query;

    let query = supabase.from('events').select('*');

    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    } else if (month && year) {
      const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const end = new Date(year, month, 0).toISOString().split('T')[0];
      query = query.gte('date', start).lte('date', end);
    }

    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    if (!req.user || req.user.role === 'member') {
      query = query.eq('is_public', true);
    }

    const { data: events, error } = await query.order('date', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch events',
        error: error.message
      });
    }

    console.log(`Found ${events.length} events`);

    res.json({
      success: true,
      events: events.map(event => ({
        id: event.id,
        title: event.title,
        type: event.type,
        date: event.date,
        time: event.time,
        location: event.location,
        description: event.description,
        organizer: event.organizer,
        isPublic: event.is_public,
        canEdit: req.user ? (req.user.role === 'admin' || req.user.role === 'executive' || event.created_by === req.user.id) : false,
        createdAt: event.created_at,
        updatedAt: event.updated_at
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

app.post('/api/events', [
  auth,
  body('title').notEmpty().withMessage('Title is required'),
  body('type').isIn(['meeting', 'webinar', 'conference', 'deadline']).withMessage('Invalid event type'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('time').notEmpty().withMessage('Time is required').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, type, date, time, location, description, organizer, isPublic } = req.body;

    const supabaseAdmin = getSupabaseAdmin();
    const { data: event, error } = await supabaseAdmin
      .from('events')
      .insert({
        title,
        type,
        date,
        time,
        location,
        description,
        organizer,
        is_public: isPublic !== false,
        created_by: req.user.id,
        school: req.user.school
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating event:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create event',
        error: error.message
      });
    }

    console.log(`Event created successfully: ${event.id}`);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: {
        id: event.id,
        title: event.title,
        type: event.type,
        date: event.date,
        time: event.time,
        location: event.location,
        description: event.description,
        organizer: event.organizer,
        isPublic: event.is_public,
        canEdit: true,
        createdAt: event.created_at,
        updatedAt: event.updated_at
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

app.put('/api/events/:id', [
  auth,
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('type').optional().isIn(['meeting', 'webinar', 'conference', 'deadline']).withMessage('Invalid event type'),
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const canEdit = req.user.role === 'admin' ||
                    req.user.role === 'executive' ||
                    event.created_by === req.user.id;

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only edit your own events.'
      });
    }

    const updates = {};
    const { title, type, date, time, location, description, organizer, isPublic } = req.body;

    if (title !== undefined) updates.title = title;
    if (type !== undefined) updates.type = type;
    if (date !== undefined) updates.date = date;
    if (time !== undefined) updates.time = time;
    if (location !== undefined) updates.location = location;
    if (description !== undefined) updates.description = description;
    if (organizer !== undefined) updates.organizer = organizer;
    if (isPublic !== undefined) updates.is_public = isPublic;

    const supabaseAdmin = getSupabaseAdmin();
    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('events')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating event:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update event',
        error: updateError.message
      });
    }

    console.log(`Event updated successfully: ${updatedEvent.id}`);

    res.json({
      success: true,
      message: 'Event updated successfully',
      event: {
        id: updatedEvent.id,
        title: updatedEvent.title,
        type: updatedEvent.type,
        date: updatedEvent.date,
        time: updatedEvent.time,
        location: updatedEvent.location,
        description: updatedEvent.description,
        organizer: updatedEvent.organizer,
        isPublic: updatedEvent.is_public,
        canEdit: true,
        createdAt: updatedEvent.created_at,
        updatedAt: updatedEvent.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating event'
    });
  }
});

app.delete('/api/events/:id', auth, async (req, res) => {
  try {
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const canDelete = req.user.role === 'admin' ||
                      req.user.role === 'executive' ||
                      event.created_by === req.user.id;

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own events.'
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error: deleteError } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) {
      console.error('Error deleting event:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete event',
        error: deleteError.message
      });
    }

    console.log(`Event deleted successfully: ${req.params.id}`);

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting event'
    });
  }
});

console.log('Events routes registered successfully');

console.log('Registering Communications routes...');

app.get('/api/communications', async (req, res) => {
  try {
    const { data: communications, error } = await supabase
      .from('communications')
      .select('*')
      .eq('is_active', true)
      .order('publish_date', { ascending: false });

    if (error) {
      console.error('Get communications error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch communications',
        error: error.message
      });
    }

    res.json({
      success: true,
      communications: communications.map(comm => ({
        id: comm.id,
        title: comm.title,
        description: comm.description,
        filename: comm.filename,
        originalName: comm.original_name,
        fileSize: comm.file_size,
        category: comm.category,
        publishDate: comm.publish_date,
        isActive: comm.is_active,
        createdAt: comm.created_at
      }))
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
      const errorMessages = errors.array().map(err => err.msg).join('. ');
      return res.status(400).json({
        success: false,
        message: errorMessages,
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

    const uploadResult = await uploadFile(req.file);

    const supabaseAdmin = getSupabaseAdmin();
    const { data: communication, error } = await supabaseAdmin
      .from('communications')
      .insert({
        title,
        description,
        filename: req.file.filename,
        original_name: req.file.originalname,
        file_size: req.file.size,
        category,
        publish_date: publishDate ? new Date(publishDate).toISOString() : new Date().toISOString(),
        uploaded_by: req.user.id,
        supabase_url: uploadResult.supabaseUrl
      })
      .select()
      .single();

    if (error) {
      await fs.unlink(req.file.path).catch(console.error);
      console.error('Upload communication error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload communication',
        error: error.message
      });
    }

    if (!uploadResult.supabaseSuccess) {
      console.warn(`File uploaded to local only: ${uploadResult.errors.join(', ')}`);
    }

    res.status(201).json({
      success: true,
      message: 'Communication uploaded successfully',
      communication: {
        id: communication.id,
        title: communication.title,
        description: communication.description,
        filename: communication.filename,
        originalName: communication.original_name,
        fileSize: communication.file_size,
        category: communication.category,
        publishDate: communication.publish_date,
        createdAt: communication.created_at
      }
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

    const { data: existingComm, error: fetchError } = await supabase
      .from('communications')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existingComm) {
      return res.status(404).json({
        success: false,
        message: 'Communication not found'
      });
    }

    const updates = {};
    const { title, description, category, publishDate } = req.body;

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (publishDate !== undefined) updates.publish_date = new Date(publishDate).toISOString();

    const supabaseAdmin = getSupabaseAdmin();
    const { data: updatedComm, error: updateError } = await supabaseAdmin
      .from('communications')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Update communication error:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update communication',
        error: updateError.message
      });
    }

    res.json({
      success: true,
      message: 'Communication updated successfully',
      communication: {
        id: updatedComm.id,
        title: updatedComm.title,
        description: updatedComm.description,
        category: updatedComm.category,
        publishDate: updatedComm.publish_date
      }
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
    const { data: communication, error: fetchError } = await supabase
      .from('communications')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !communication) {
      return res.status(404).json({
        success: false,
        message: 'Communication not found'
      });
    }

    const deleteResult = await deleteFile(communication.filename);

    if (!deleteResult.localSuccess && !deleteResult.supabaseSuccess) {
      console.error('Failed to delete file from both storages:', deleteResult.errors);
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error: deleteError } = await supabaseAdmin
      .from('communications')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) {
      console.error('Delete communication error:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete communication',
        error: deleteError.message
      });
    }

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

console.log('Communications routes registered successfully');

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Supabase PostgreSQL'
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'INTERPARENTS API Server - Full Supabase Stack',
    version: '3.0.0',
    authentication: 'Supabase Auth',
    database: 'Supabase PostgreSQL',
    features: ['Users', 'Events', 'Communications'],
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      users: '/api/users',
      events: '/api/events',
      communications: '/api/communications'
    }
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 10}MB.`
      });
    }
  }

  if (err.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only PDF files are allowed'
    });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy: Request from unauthorized origin'
    });
  }

  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong!'
      : err.message
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const startServer = async () => {
  console.log('Verifying Supabase connection...');
  const { data, error } = await supabase
    .from('user_profiles')
    .select('count')
    .limit(1);

  if (error) {
    console.error('Supabase connection failed:', error);
    console.error('Please check your SUPABASE_URL and SUPABASE_ANON_KEY');
    process.exit(1);
  }

  console.log('Supabase connection verified');

  app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Authentication: Supabase Auth`);
    console.log(`Database: Supabase PostgreSQL (100% Supabase)`);
    console.log('='.repeat(60));
  });
};

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;

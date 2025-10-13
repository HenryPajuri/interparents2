# InterParents - Parent Association Management Platform

A production-ready web application for managing parent association activities, events, documents, and communications across European schools.

## Features

- **User Authentication** - Secure login with Supabase Auth
- **Role-Based Access** - Admin, Executive, and Member roles
- **Document Management** - Upload, organize, and share documents
- **Calendar & Events** - Manage meetings, webinars, and deadlines
- **Communications** - Internal messaging system
- **Multi-School Support** - Support for multiple schools across Europe

## Architecture

- **Frontend**: Static HTML/CSS/JS served by Nginx
- **Backend**: Node.js/Express API (Port 3001)
- **Database**: Supabase PostgreSQL (Cloud-hosted)
- **Authentication**: Supabase Auth with Row Level Security (RLS)
- **Process Manager**: PM2 for backend auto-restart and monitoring
- **Web Server**: Nginx for static files and reverse proxy

## Production Deployment

We provide two deployment options:

### Option 1: PM2 + Nginx Deployment (Recommended)
See **[DEPLOYMENT_NO_DOCKER.md](DEPLOYMENT_NO_DOCKER.md)** for complete deployment guide.

**Best for:** Traditional hosting, VPS, Keyweb servers

**Features:**
- PM2 process management with auto-restart
- Nginx serving static files + reverse proxy
- SSL with Let's Encrypt
- Lower resource usage

### Option 2: Docker Deployment
See **[DEPLOYMENT.md](DEPLOYMENT.md)** for Docker-based deployment.

**Best for:** Containerized environments, Docker-enabled servers

## Quick Deployment Overview

### Prerequisites
1. Linux server (Ubuntu/Debian recommended)
2. Node.js 18+ LTS
3. Nginx web server
4. Supabase project (already created)
5. Domain name pointed to server

### Deployment Steps

1. **Upload application files** via SFTP/FTP to `/var/www/interparents/`
2. **Configure environment** - Upload `.env.production` file (provided separately)
3. **Install dependencies** - Run `npm install --production` in server directory
4. **Start backend** - Use PM2 to start and manage Node.js process
5. **Configure Nginx** - Set up reverse proxy and static file serving
6. **Install SSL** - Use Certbot for Let's Encrypt certificates
7. **Verify deployment** - Test frontend, API, and login

See deployment guides for detailed step-by-step instructions.

## Database Setup

The application uses **Supabase PostgreSQL** (cloud-hosted database).

### Initial Setup
1. Create Supabase project at https://supabase.com
2. Run SQL schema from `SUPABASE_FULL_SCHEMA.sql` in Supabase SQL Editor
3. Create first admin user via Supabase Dashboard → Authentication → Users
4. Update user role to admin:
   ```sql
   UPDATE user_profiles
   SET role = 'admin',
       name = 'Admin Name',
       school = 'INTERPARENTS Central',
       position = 'Administrator'
   WHERE email = 'your-admin@email.com';
   ```

## Security Features

- Supabase Authentication with JWT tokens
- Row Level Security (RLS) policies on all database tables
- HTTP-only secure cookies
- Helmet.js security headers
- Rate limiting (300 requests per 15 minutes, 15 for login)
- Input validation with express-validator
- No hardcoded credentials
- Environment-based configuration
- CORS protection

## Project Structure

```
interparents/
├── Front-end/
│   └── html/
│       ├── css/           # Stylesheets
│       ├── js/            # Client-side JavaScript
│       ├── images/        # Static images
│       └── *.html         # HTML pages (index, login, dashboard, etc.)
├── server/
│   ├── config/            # Supabase client, environment validation
│   ├── middleware/        # Authentication middleware
│   ├── routes/            # API routes (auth, users, events, communications)
│   ├── utils/             # Utility functions
│   ├── data/
│   │   └── documents/     # Uploaded PDF files
│   ├── server.js          # Main server file (100% Supabase)
│   ├── package.json
│   ├── .env.example       # Environment template
│   └── .env.production    # Production environment (not in git)
├── DEPLOYMENT.md          # Docker deployment guide
├── DEPLOYMENT_NO_DOCKER.md # PM2 + Nginx deployment guide (recommended)
├── SUPABASE_FULL_SCHEMA.sql # Complete database schema
└── README.md              # This file
```

## API Endpoints

### Authentication (`/api/auth/*`)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Events (`/api/events`)
- `GET /api/events` - List all events (filtered by role)
- `POST /api/events` - Create event (admin/executive)
- `PUT /api/events/:id` - Update event (admin/executive)
- `DELETE /api/events/:id` - Delete event (admin/executive)

### Users (`/api/users`)
- `GET /api/users` - List all users (admin only)
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Communications (`/api/communications`)
- `GET /api/communications` - List all documents
- `POST /api/communications` - Upload PDF (admin/executive)
- `PUT /api/communications/:id` - Update metadata (admin/executive)
- `DELETE /api/communications/:id` - Delete document (admin/executive)

### Static Files
- `/pdf/*` - PDF document downloads
- `/assets/*` - Static assets

## Environment Configuration

Production environment variables are configured in `.env.production` file:

**Required Variables:**
- `NODE_ENV=production`
- `PORT=3001`
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `SESSION_SECRET` - Random 64-character string
- `FRONTEND_URL=https://interparents.eu`
- `MAX_FILE_SIZE_MB=10`

See [.env.example](server/.env.example) for complete reference.

## Database Schema

The application uses **100% Supabase PostgreSQL** with the following tables:

- `user_profiles` - User information and roles (linked to Supabase Auth)
- `events` - Calendar events with creator tracking
- `communications` - Document metadata (PDFs)
- `event_attendees` - Event participation tracking (optional, future)
- `event_attachments` - Event-related files (optional, future)

**All tables have Row Level Security (RLS) enabled** for database-level permission enforcement.

## Password Requirements

- Minimum 8 characters
- Must contain at least 3 of: lowercase, uppercase, number, special character
- Enforced at both application and Supabase level

## Maintenance

### Updating the Application
1. Upload new files via SFTP/FTP (overwrite existing)
2. SSH into server and run:
   ```bash
   cd /var/www/interparents/server
   npm install --production
   pm2 restart interparents-backend
   ```

### Viewing Logs
```bash
# Backend logs
pm2 logs interparents-backend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Monitoring
```bash
# Check backend status
pm2 status

# Real-time monitoring
pm2 monit
```

### Backup
- **Database**: Supabase handles automatic backups
- **PDF Files**: Regular backups of `/var/www/interparents/server/data/documents/`
- **Environment**: Secure backup of `.env` file

See deployment guides for automated backup scripts.

## Support & Documentation

- **Deployment Guide (No Docker)**: [DEPLOYMENT_NO_DOCKER.md](DEPLOYMENT_NO_DOCKER.md)
- **Deployment Guide (Docker)**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Database Schema**: [SUPABASE_FULL_SCHEMA.sql](SUPABASE_FULL_SCHEMA.sql)
- **Architecture Guide**: [CLAUDE.md](CLAUDE.md)

## Production URLs

- **Frontend**: https://interparents.eu
- **Backend API**: https://interparents.eu/api
- **PDF Files**: https://interparents.eu/pdf/{filename}
- **Login Page**: https://interparents.eu/login.html

## Version

- **Version**: 2.0.0
- **Last Updated**: 2025-10-13
- **Node.js**: 18+ LTS
- **Database**: Supabase PostgreSQL
- **License**: MIT

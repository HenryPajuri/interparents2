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

- **Frontend**: Static HTML/CSS/JS (Nginx)
- **Backend**: Node.js/Express API
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth with Row Level Security (RLS)

## Prerequisites

- Node.js 18+ LTS
- Supabase account and project
- (Optional) Docker and Docker Compose

## Quick Start - Development

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/interparents2.git
cd interparents2
```

### 2. Setup Backend

```bash
cd server

# Install dependencies
npm install

# Create environment file from example
cp .env.example .env

# Edit .env and add your Supabase credentials
nano .env
```

**Required environment variables:**
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=generate-a-random-string
```

Generate a secure session secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Setup Supabase Database

1. Go to your Supabase project: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Copy and run the schema from `server/SUPABASE_FULL_SCHEMA.sql`
4. Create your first admin user:
   - Go to **Authentication → Users**
   - Click "Add user" → "Create new user"
   - Check "Auto Confirm User"
   - After creation, run this SQL:
   ```sql
   UPDATE user_profiles
   SET role = 'admin',
       name = 'Admin Name',
       school = 'INTERPARENTS Central',
       position = 'Administrator'
   WHERE email = 'your-admin@email.com';
   ```

### 4. Start Development Servers

**Backend:**
```bash
cd server
npm run dev
```
Backend runs at: http://localhost:3001

**Frontend:**
```bash
# In a new terminal, from project root
npx http-server Front-end/html -p 8080 -c-1
```
Frontend runs at: http://localhost:8080

### 5. Login

Visit http://localhost:8080/login.html and login with your admin credentials.

## Quick Start - Docker

```bash
cd server

# Make sure .env file is configured
docker-compose up -d --build

# View logs
docker-compose logs -f
```

Services:
- Frontend: http://localhost:8080
- Backend: http://localhost:3001

## Deployment

We provide two deployment guides:

### Option 1: Docker Deployment
See [DEPLOYMENT.md](DEPLOYMENT.md) for Docker-based deployment to production servers.

**Best for:** Servers with Docker support, containerized environments

### Option 2: Direct Deployment (No Docker)
See [DEPLOYMENT_NO_DOCKER.md](DEPLOYMENT_NO_DOCKER.md) for PM2 + Nginx deployment.

**Best for:** Traditional hosting, VPS, Keyweb servers

## Security Features

- Supabase Authentication with JWT tokens
- Row Level Security (RLS) policies on all database tables
- HTTP-only secure cookies
- Helmet.js security headers
- Rate limiting (300 requests per 15 minutes)
- Input validation with express-validator
- No hardcoded credentials
- Environment-based configuration

## Project Structure

```
interparents2/
├── Front-end/
│   └── html/
│       ├── css/           # Stylesheets
│       ├── js/            # Client-side JavaScript
│       ├── images/        # Static images
│       └── *.html         # HTML pages
├── server/
│   ├── config/            # Configuration files
│   ├── middleware/        # Express middleware
│   ├── routes/            # API routes
│   ├── utils/             # Utility functions
│   ├── data/
│   │   └── documents/     # Uploaded PDF files
│   ├── server.js          # Main server file
│   ├── package.json
│   ├── .env.example       # Environment template
│   ├── Dockerfile
│   └── docker-compose.yml
├── DEPLOYMENT.md          # Docker deployment guide
├── DEPLOYMENT_NO_DOCKER.md # PM2 deployment guide
└── README.md
```

## Development

### Available Scripts

```bash
# Backend
npm start       # Start production server
npm run dev     # Start development server with auto-reload
```

### API Endpoints

**Authentication:**
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

**Events:**
- `GET /api/events` - List all events
- `POST /api/events` - Create event (admin/executive)
- `PUT /api/events/:id` - Update event (admin/executive)
- `DELETE /api/events/:id` - Delete event (admin)

**Users:**
- `GET /api/users` - List all users (admin)
- `POST /api/users` - Create user (admin)
- `PUT /api/users/:id` - Update user (admin)

## Environment Variables Reference

See [.env.example](server/.env.example) for complete list of configuration options.

**Required:**
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `SESSION_SECRET` - Random string for sessions
- `FRONTEND_URL` - Frontend URL for CORS

**Optional:**
- `MAX_FILE_SIZE` - Upload size limit
- `SMTP_*` - Email configuration (future feature)

## Database Schema

The application uses Supabase PostgreSQL with the following main tables:

- `user_profiles` - User information and roles
- `events` - Calendar events
- `communications` - Messages and announcements
- `event_attendees` - Event participation tracking
- `event_attachments` - Event-related files

All tables have Row Level Security (RLS) enabled.

## License

This project is licensed under the MIT License.

## Version

- **Version**: 2.0.0
- **Last Updated**: 2025-10-09
- **Node.js**: 18+ LTS
- **Database**: Supabase PostgreSQL


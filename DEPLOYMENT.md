# InterParents Deployment Guide (Keyweb)

This guide covers deploying the InterParents application to Keyweb using Docker.

## Architecture Overview

- **Frontend**: Nginx serving static HTML/CSS/JS files
- **Backend**: Node.js/Express API (port 3001)
- **Database**: Supabase PostgreSQL (cloud-hosted)
- **Authentication**: Supabase Auth

## Prerequisites

1. **Keyweb Server** with Docker and Docker Compose installed
2. **Supabase Project** (already created at https://nrjmquporeadbbaysbgf.supabase.co)
3. **Domain Name** pointed to your Keyweb server
4. **SSL Certificate** (Let's Encrypt recommended)

## Deployment Steps

### 1. Prepare the Server

SSH into your Keyweb server:
```bash
ssh user@your-server.keyweb.de
```

Install Docker and Docker Compose (if not already installed):
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Add your user to docker group
sudo usermod -aG docker $USER
```

### 2. Upload Application Files

**Option A: Using FTP/SFTP Client (FileZilla, WinSCP, etc.)**
1. Connect to your server via SFTP
2. Create directory: `/var/www/interparents`
3. Upload `Front-end` folder → `/var/www/interparents/Front-end/`
4. Upload `server` folder → `/var/www/interparents/server/`
   - **EXCLUDE**: `node_modules` folder (will install fresh on server)
   - **EXCLUDE**: `.env` file (will create manually on server)

**Option B: Using SCP/rsync**
```bash
# From your local machine
scp -r Front-end/ user@your-server:/var/www/interparents/
scp -r server/ user@your-server:/var/www/interparents/

# OR using rsync (excludes node_modules automatically)
rsync -avz --exclude 'node_modules' --exclude '.env' \
  ./Front-end/ user@your-server:/var/www/interparents/Front-end/
rsync -avz --exclude 'node_modules' --exclude '.env' \
  ./server/ user@your-server:/var/www/interparents/server/
```

### 3. Configure Environment Variables

**You will receive a `.env.production` file separately via secure channel.**

Upload it to the server:
```bash
# Option A: Via SFTP client
# Upload the .env.production file to /var/www/interparents/server/.env

# Option B: Via SCP
scp .env.production user@your-server:/var/www/interparents/server/.env

# Option C: Create manually on server (if needed)
cd /var/www/interparents/server
nano .env
# Paste the contents from the .env.production file you received
```

Secure the file:
```bash
chmod 600 /var/www/interparents/server/.env
```

### 4. Frontend API URLs (Already Configured)

**No changes needed!** The frontend automatically detects the environment:
- **Development** (localhost): Uses `http://localhost:3001/api`
- **Production** (interparents.eu): Uses `https://interparents.eu/api`

All JavaScript files use hostname detection to switch between local and production APIs.

### 5. Configure Nginx for Production

Create/update nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/interparents
```

Add the following configuration:
```nginx
# Main server block
server {
    listen 80;
    server_name interparents.eu www.interparents.eu;

    # Document root for static files
    root /var/www/interparents/Front-end/html;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # PDF files served by backend
    location /pdf/ {
        proxy_pass http://localhost:3001/pdf/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static frontend files
    location / {
        try_files $uri $uri/ =404;
    }

    # Static assets caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Disable access to hidden files
    location ~ /\. {
        deny all;
    }
}
```

Enable the site:
```bash
# Test configuration
sudo nginx -t

# Enable the site
sudo ln -s /etc/nginx/sites-available/interparents /etc/nginx/sites-enabled/

# Restart Nginx
sudo systemctl restart nginx
```

### 6. Install SSL Certificates

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificates for your domain
sudo certbot --nginx -d interparents.eu -d www.interparents.eu

# Certbot will automatically:
# - Update Nginx config for HTTPS
# - Set up auto-renewal
```

### 7. Start Backend with PM2

```bash
cd /var/www/interparents/server

# Install dependencies
npm install --production

# Install PM2 globally (if not already installed)
sudo npm install -g pm2

# Start the backend
pm2 start server.js --name interparents-backend

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Run the command that PM2 outputs
```

### 8. Verify Deployment

1. **Backend Health**:
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Frontend**: Visit https://interparents.eu

3. **API**: Visit https://interparents.eu/api/health

4. **Test Login**: https://interparents.eu/login.html

### 9. Check Logs

```bash
# Backend logs (PM2)
pm2 logs interparents-backend

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

## Database Setup (Supabase)

Your Supabase database is already configured. Ensure:

1. **Schema is created** - Run `SUPABASE_FULL_SCHEMA.sql` in Supabase SQL Editor
2. **RLS policies are enabled** - Check in Supabase Dashboard → Database → Tables
3. **Admin user exists** - Create via Supabase Dashboard → Authentication → Users

## Maintenance

### Update the Application

1. Upload new files via FTP/SFTP (overwrite existing files)
2. SSH into server and restart:
```bash
cd /var/www/interparents/server
docker-compose down
docker-compose up -d --build
```

### Backup Strategy

**Database**: Supabase handles automatic backups
**Files**: Backup `/var/www/interparents/server/data/documents` directory regularly

```bash
# Create backup script
sudo nano /usr/local/bin/backup-interparents.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backups/interparents"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PDF files
tar -czf $BACKUP_DIR/pdf_backup_$DATE.tar.gz /var/www/interparents/server/data/documents

# Keep only last 30 days of backups
find $BACKUP_DIR -name "pdf_backup_*.tar.gz" -mtime +30 -delete
```

```bash
chmod +x /usr/local/bin/backup-interparents.sh
# Add to crontab: 0 2 * * * /usr/local/bin/backup-interparents.sh
```

### Monitor Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Restart Services

```bash
cd /var/www/interparents/server
docker-compose restart
```

## Troubleshooting

### Backend Not Starting

1. Check environment variables:
```bash
docker exec interparents-backend printenv | grep SUPABASE
```

2. Check logs:
```bash
docker logs interparents-backend --tail 100
```

### Database Connection Issues

1. Verify Supabase keys are correct
2. Check RLS policies aren't blocking queries
3. Use service role key for admin operations

### Frontend Can't Connect to Backend

1. Check CORS settings in backend
2. Verify API URL in frontend JavaScript
3. Check Nginx proxy configuration


## Version

- Application: v2.0.0
- Node.js: 18 LTS
- Database: Supabase PostgreSQL
- Last Updated: 2025-10-09

# InterParents Deployment Guide (Keyweb - Without Docker)

This guide covers deploying the InterParents application to Keyweb **without Docker**, using PM2 and Nginx directly.

## Architecture Overview

- **Frontend**: Nginx serving static HTML/CSS/JS files
- **Backend**: Node.js/Express API (port 3001) managed by PM2
- **Database**: Supabase PostgreSQL (cloud-hosted)
- **Authentication**: Supabase Auth

## Prerequisites

1. **Keyweb Server** with SSH access
2. **Node.js 18+** installed
3. **Nginx** installed
4. **PM2** (process manager for Node.js)
5. **Supabase Project** (already created)
6. **Domain Name** pointed to your Keyweb server

## Deployment Steps

### 1. Prepare the Server

SSH into your Keyweb server:
```bash
ssh user@your-server.keyweb.de
```

Install required software:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx (if not already installed)
sudo apt install nginx -y
```

### 2. Upload Application Files

**Option A: Using FTP/SFTP Client (FileZilla, WinSCP, etc.)**
1. Create directory on server: `/var/www/interparents`
2. Upload `Front-end` folder → `/var/www/interparents/Front-end/`
3. Upload `server` folder → `/var/www/interparents/server/`
   - **EXCLUDE**: `node_modules` folder (will install fresh on server)
   - **EXCLUDE**: `.env` file (will create manually on server)

**Option B: Using SCP/rsync**
```bash
# From your local machine
rsync -avz --exclude 'node_modules' --exclude '.env' \
  ./Front-end/ user@your-server:/var/www/interparents/Front-end/
rsync -avz --exclude 'node_modules' --exclude '.env' \
  ./server/ user@your-server:/var/www/interparents/server/
```

**Set proper permissions on server:**
```bash
ssh user@your-server
sudo chown -R $USER:$USER /var/www/interparents
```

### 3. Configure Backend

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

Secure the file and install dependencies:
```bash
cd /var/www/interparents/server
chmod 600 .env
npm install --production
```

### 4. Start Backend with PM2

```bash
cd /var/www/interparents/server

# Start the application
pm2 start server.js --name interparents-backend

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Run the command that PM2 outputs (it will give you a sudo command)
```

Check that it's running:
```bash
pm2 status
pm2 logs interparents-backend
```

### 5. Configure Nginx

Create Nginx configuration for frontend and backend:

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

### 7. Setup Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 8. Verify Deployment

1. **Backend Health**:
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Frontend**: Visit https://interparents.eu

3. **API**: Visit https://interparents.eu/api/health (or curl http://localhost:3001/api/health)

4. **Test Login**: https://interparents.eu/login.html

## Maintenance

### Update Application

1. **Upload new files** via FTP/SFTP (overwrite existing files)
2. **Update backend dependencies**:
   ```bash
   cd /var/www/interparents/server
   npm install --production
   ```
3. **Restart backend**:
   ```bash
   pm2 restart interparents-backend
   ```
4. **Check logs**:
   ```bash
   pm2 logs interparents-backend
   ```

### View Logs

```bash
# Backend logs (PM2)
pm2 logs interparents-backend

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
# Restart backend
pm2 restart interparents-backend

# Restart Nginx
sudo systemctl restart nginx
```

### Monitor Backend

```bash
# View status
pm2 status

# View detailed info
pm2 show interparents-backend

# Monitor in real-time
pm2 monit
```

### Backup Strategy

**Database**: Supabase handles automatic backups

**PDF Files**: Backup the PDF directory regularly

```bash
# Create backup script
sudo nano /usr/local/bin/backup-interparents.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backups/interparents"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Backup PDF files
tar -czf $BACKUP_DIR/pdf_backup_$DATE.tar.gz /var/www/interparents/server/data/documents

# Backup environment file (contains secrets - handle carefully!)
cp /var/www/interparents/server/.env $BACKUP_DIR/env_backup_$DATE

# Keep only last 30 days of backups
find $BACKUP_DIR -name "pdf_backup_*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "env_backup_*" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Make it executable and schedule:
```bash
chmod +x /usr/local/bin/backup-interparents.sh

# Add to crontab (runs daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-interparents.sh") | crontab -
```

## Troubleshooting

### Backend Not Starting

1. **Check PM2 logs**:
   ```bash
   pm2 logs interparents-backend --lines 100
   ```

2. **Check environment variables**:
   ```bash
   cd /var/www/interparents/server
   cat .env
   ```

3. **Test manually**:
   ```bash
   cd /var/www/interparents/server
   node server.js
   ```

### Nginx Configuration Errors

```bash
# Test configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### Frontend Not Loading

1. Check file permissions:
   ```bash
   ls -la /var/www/interparents/Front-end/html
   sudo chown -R www-data:www-data /var/www/interparents/Front-end
   ```

2. Check Nginx error logs:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

## Performance Optimization

### Enable Gzip Compression in Nginx

Add to `/etc/nginx/nginx.conf`:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
```

### PM2 Cluster Mode (Optional)

For better performance, run multiple instances:
```bash
pm2 delete interparents-backend
pm2 start server.js --name interparents-backend -i max
pm2 save
```

## Support

For issues:
- PM2 Documentation: https://pm2.keymetrics.io/docs
- Nginx Documentation: https://nginx.org/en/docs

## Version

- Application: v2.0.0
- Node.js: 18 LTS
- PM2: Latest
- Nginx: Latest
- Last Updated: 2025-10-09

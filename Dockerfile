# Use the official Nginx image as base
FROM nginx:alpine

# Remove the default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration (from server directory)
COPY server/nginx.conf /etc/nginx/conf.d/

# Copy the Front-end files to the Nginx document root
COPY Front-end/ /usr/share/nginx/html/

# Copy PDF files from the server directory
COPY server/pdf/ /usr/share/nginx/html/pdf/

# Create any missing directories
RUN mkdir -p /usr/share/nginx/html/css /usr/share/nginx/html/js

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
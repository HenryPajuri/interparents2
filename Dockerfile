FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY server/nginx.conf /etc/nginx/conf.d/

COPY Front-end/ /usr/share/nginx/html/

COPY server/pdf/ /usr/share/nginx/html/pdf/

# Create any missing directories
RUN mkdir -p /usr/share/nginx/html/css /usr/share/nginx/html/js

EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
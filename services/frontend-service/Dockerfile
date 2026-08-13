# Stage 1: Build React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Upgrade packages to patch base image vulnerabilities (e.g., libexpat) and install libcap
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache libcap && \
    setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx && \
    apk del libcap

# Create Nginx pid file and set correct ownership on required directories
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d /usr/share/nginx/html

# Switch to the non-root 'nginx' user
USER nginx

COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html
# Copy template — BACKEND_URL is substituted at container startup via envsubst
COPY --chown=nginx:nginx nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["/docker-entrypoint.sh", "nginx", "-g", "daemon off;"]

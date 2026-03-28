# syntax=docker/dockerfile:1

# ===========================================
# Stage 1: Build the Vite application
# ===========================================
FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# ===========================================
# Stage 2: Install bridge dependencies
# ===========================================
FROM node:24-alpine AS bridge-deps

WORKDIR /app/bridge
COPY bridge/package.json bridge/package-lock.json* ./
RUN npm install --production

# ===========================================
# Stage 3: Serve with Nginx + WS Bridge
# ===========================================
FROM node:24-alpine

# Install nginx
RUN apk add --no-cache nginx

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Pre-compress EGF files (406MB → ~20MB with gzip)
# nginx gzip_static will serve the .gz versions automatically
RUN find /usr/share/nginx/html/gfx -name '*.egf' -exec gzip -9 -k {} \;

# Override config.json with production values
RUN printf '{\n  "host": "wss://client.calamity-online.cloud/ws",\n  "staticHost": true,\n  "title": "Endless Memories",\n  "slogan": "Web Edition!",\n  "creditsUrl": "https://github.com/sorokya/eoweb"\n}\n' > /usr/share/nginx/html/config.json

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy bridge code and dependencies
COPY bridge/bridge.js /app/bridge/
COPY --from=bridge-deps /app/bridge/node_modules /app/bridge/node_modules

# Copy entrypoint
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 80

CMD ["/app/entrypoint.sh"]
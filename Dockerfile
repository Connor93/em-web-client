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
# Stage 2: Serve with Nginx
# ===========================================
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Pre-compress EGF files (406MB → ~20MB with gzip)
# nginx gzip_static will serve the .gz versions automatically
RUN find /usr/share/nginx/html/gfx -name '*.egf' -exec gzip -9 -k {} \;

# Override config.json with production values
RUN printf '{\n  "host": "wss://client.calamity-online.cloud/ws",\n  "staticHost": true,\n  "title": "Endless Memories",\n  "slogan": "Web Edition!",\n  "creditsUrl": "https://github.com/sorokya/eoweb",\n  "dashboardUrl": ""\n}\n' > /usr/share/nginx/html/config.json

# Copy custom nginx configuration (replace the default that ships with nginx:alpine)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
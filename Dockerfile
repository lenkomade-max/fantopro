# FantaProjekt Production Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Build
FROM node:18-bookworm AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
# Use --legacy-peer-deps to resolve zod version conflicts
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build TypeScript (tsc) - skip vite UI build
RUN npm run build || (npx tsc --project tsconfig.build.json && echo "Vite build skipped, TypeScript compiled successfully")

# Stage 2: Production Runtime
FROM node:18-bookworm-slim

WORKDIR /app

# Install system dependencies for FFmpeg, Whisper, face-api.js, and native modules
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    chromium \
    chromium-driver \
    wget \
    git \
    build-essential \
    cmake \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp for VideoAnalyzer
RUN wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy entire src folder (required by Remotion bundler at runtime)
COPY --from=builder /app/src ./src

# Copy static assets (music, effects, etc.)
COPY static ./static

# Copy remotion config
COPY remotion.config.ts ./remotion.config.ts
COPY tsconfig.json ./tsconfig.json

# Create directories for runtime data
# NOTE: DO NOT create whisper directory - it will be created by Whisper.init() on first run
RUN mkdir -p /app/static/video-analyzer/uploads \
    /app/static/video-analyzer/clips \
    /app/static/effects \
    /app/fantaprojekt-libs/libs \
    /app/workspace/temp \
    && chmod -R 777 /app/static \
    && chmod -R 777 /app/fantaprojekt-libs \
    && chmod -R 777 /app/workspace

# Environment variables
ENV NODE_ENV=production \
    PORT=3123 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Expose API port
EXPOSE 3123

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3123/api/voices', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start the server
CMD ["node", "dist/index.js"]

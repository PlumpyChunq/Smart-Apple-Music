# InterChord - Multi-stage Dockerfile for production deployment
# Compatible with both Docker and Podman

# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (production + dev for build)
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for NEXT_PUBLIC_ variables (must be set at build time)
ARG NEXT_PUBLIC_SPOTIFY_CLIENT_ID
ARG NEXT_PUBLIC_SPOTIFY_REDIRECT_URI
ARG NEXT_PUBLIC_MUSICBRAINZ_API
ARG NEXT_PUBLIC_FANART_API_KEY
ARG NEXT_PUBLIC_LASTFM_API_KEY
ARG NEXT_PUBLIC_DISCOGS_TOKEN
ARG NEXT_PUBLIC_APP_URL

# Set environment variables for build
ENV NEXT_PUBLIC_SPOTIFY_CLIENT_ID=$NEXT_PUBLIC_SPOTIFY_CLIENT_ID
ENV NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=$NEXT_PUBLIC_SPOTIFY_REDIRECT_URI
ENV NEXT_PUBLIC_MUSICBRAINZ_API=$NEXT_PUBLIC_MUSICBRAINZ_API
ENV NEXT_PUBLIC_FANART_API_KEY=$NEXT_PUBLIC_FANART_API_KEY
ENV NEXT_PUBLIC_LASTFM_API_KEY=$NEXT_PUBLIC_LASTFM_API_KEY
ENV NEXT_PUBLIC_DISCOGS_TOKEN=$NEXT_PUBLIC_DISCOGS_TOKEN
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN pnpm build

# =============================================================================
# Stage 3: Runner (Production)
# =============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set hostname to listen on all interfaces
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/musicbrainz/health || exit 1

# Start the server
CMD ["node", "server.js"]

# ══════════════════════════════════════════════════════════════════════════════
# server.Dockerfile — Multi-stage production build
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl dumb-init

# Install dependencies (separate layer for cache efficiency)
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Final image
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create logs directory
RUN mkdir -p logs && chown -R node:node /app

# Security: run as non-root
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/app.js"]

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Source prisma packages from the deps stage (clean npm-managed install).
# valibot is a runtime dependency of @prisma/dev (used by the prisma CLI
# to parse prisma.config.ts) and must be present alongside the CLI.
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/valibot ./node_modules/valibot

# Create a proper symlink so __dirname inside the prisma binary resolves to
# the package directory where prisma_schema_build_bg.wasm actually lives.
# (Docker COPY dereferences symlinks, breaking the default __dirname lookup.)
RUN mkdir -p node_modules/.bin && \
    BIN_PATH=$(node -e "console.log(require('./node_modules/prisma/package.json').bin.prisma)") && \
    ln -sf "../prisma/$BIN_PATH" node_modules/.bin/prisma && \
    chmod +x "node_modules/prisma/$BIN_PATH"

COPY --from=builder --chown=nextjs:nodejs /app/src/generated/prisma ./src/generated/prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations then start
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node server.js"]

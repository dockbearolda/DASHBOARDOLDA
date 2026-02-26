FROM node:20-alpine AS base

# Install ALL dependencies (dev + prod) — reused by both builder and runner
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

# Copy the full node_modules from the deps stage.
# Prisma 7.x CLI pulls in @prisma/dev which requires packages from the unjs
# ecosystem (valibot, pathe, jiti, …). Some of these may only be present as
# devDependencies of transitive packages, so --omit=dev is not safe here.
# The deps stage already has the complete tree; reusing it is the simplest
# way to guarantee every module the CLI needs is present.
COPY --from=deps /app/node_modules ./node_modules

# Ensure the prisma .bin entry is a proper symlink so __dirname inside the
# binary resolves to the package directory where the WASM engine lives.
RUN mkdir -p node_modules/.bin && \
    BIN_PATH=$(node -e "console.log(require('./node_modules/prisma/package.json').bin.prisma)") && \
    ln -sf "../prisma/$BIN_PATH" node_modules/.bin/prisma && \
    chmod +x "node_modules/prisma/$BIN_PATH"

COPY --from=builder --chown=nextjs:nodejs /app/src/generated/prisma ./src/generated/prisma
COPY --from=builder /app/scripts ./scripts

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 1. Migrate enum English→French directly in DB (idempotent, skips if already French)
# 2. db push sees zero schema drift → exits immediately
# 3. Start app
CMD ["sh", "-c", "node scripts/db-resolve.mjs && node_modules/.bin/prisma db push && node server.js"]

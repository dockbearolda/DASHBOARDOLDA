FROM node:20-alpine AS base

# All dependencies (dev + prod) for the build stage
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Production-only dependencies for the runner
FROM base AS prod-deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

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

# Copy ALL production node_modules so the prisma CLI has every transitive dep.
# Prisma 7.x loads @prisma/dev which pulls in valibot, pathe, jiti, mlly, and
# more from the unjs ecosystem — cherry-picking individual packages is fragile.
# prod-deps uses the same lockfile as builder so versions are identical.
COPY --from=prod-deps /app/node_modules ./node_modules

# Ensure the prisma .bin entry is a real symlink regardless of Docker's
# symlink-handling behaviour, so __dirname resolves inside the package dir
# where prisma_schema_build_bg.wasm actually lives.
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

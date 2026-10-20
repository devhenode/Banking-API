# -------------------------------------------------------------------
# Stage 1: Base image with OpenSSL for Prisma Alpine engine
# -------------------------------------------------------------------
FROM node:22-alpine AS base

RUN apk add --no-cache openssl

WORKDIR /app

# -------------------------------------------------------------------
# Stage 2: Builder (compilation and Prisma client generation)
# -------------------------------------------------------------------
FROM base AS builder

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json tsconfig.build.json nest-cli.json prisma7.config.ts ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma Client (outputs to src/generated/prisma)
RUN npx prisma generate

# Compile TypeScript to dist/
RUN npm run build

# Prune devDependencies to keep the production layer lean
RUN npm prune --omit=dev --ignore-scripts

# -------------------------------------------------------------------
# Stage 3: Production Runner (secure, non-root user)
# -------------------------------------------------------------------
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy production node_modules from builder
COPY --chown=node:node --from=builder /app/node_modules ./node_modules

# Copy compiled application code and schema files
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/prisma7.config.ts ./prisma7.config.ts
COPY --chown=node:node --from=builder /app/package.json ./package.json

# Copy and set up container entrypoint script
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Run as unprivileged non-root node user (The Security Gate)
USER node

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]

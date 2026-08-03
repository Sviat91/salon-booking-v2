# syntax=docker/dockerfile:1
#
# Multi-stage production build for Salon Booking.
# See handoff/deploy_plan.md for the reasoning behind every non-obvious line below.

# ---- deps: install full dependencies (needed to build) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: generate the Prisma client and build the Next.js app ----
FROM node:20-alpine AS builder
WORKDIR /app
# Prisma's query engine needs OpenSSL on Alpine (musl) — without this, `prisma
# generate` produces a binary that fails at runtime with "Unable to require
# libquery_engine" errors.
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js's build-time "Collecting page data" step imports every API route
# module for static analysis, including ones that transitively load
# src/lib/encryption.ts — which throws at import time if AUTH_SECRET is empty.
# The real .env is deliberately excluded from the build context (see
# .dockerignore, "never let real secrets end up baked into an image layer"),
# so this stage never has a real one. This placeholder only satisfies that
# import-time guard; it is never used for any real encryption and does not
# carry over into the runner stage below (Docker multi-stage builds don't
# inherit ENV across stages). The real AUTH_SECRET is supplied at container
# start via docker-compose's `env_file: .env`.
ENV AUTH_SECRET=build-time-placeholder-not-used-at-runtime
RUN npx prisma generate
RUN npm run build

# ---- runner: slim production image ----
FROM node:20-alpine AS runner
WORKDIR /app
# Same OpenSSL requirement as the builder stage, but for the query engine at
# request time (this is where the app actually runs).
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Production-only node_modules, installed from the real lockfile (reproducible).
# `tsx` and `prisma` (the CLI, not just @prisma/client) are deliberately kept in
# "dependencies" (not devDependencies) so `npm ci --omit=dev` installs them here —
# both are needed as one-off/every-start CLI tools in this image (see AD-3 in the
# deploy plan; the CLI package "prisma" was moved alongside tsx for the identical
# reason: `prisma migrate deploy` must run on every container start without
# reaching out to the npm registry).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# `npm ci` does NOT run `prisma generate` (no postinstall script wires this up) —
# the generated client + platform query-engine binary only exists in the builder
# stage. Copy it explicitly rather than relying on Next's standalone output
# tracing to have caught it: it did in local testing (verified manually against
# this build), but that's a known fragile area across Next.js versions — keep
# this explicit copy as the safety net called out in the deploy plan's risk notes.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Needed at runtime for `prisma migrate deploy` (schema + migration history).
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/prisma/migrations ./prisma/migrations

# Needed for the one-off SUPERADMIN bootstrap (`scripts/create-admin.ts`, run via
# `tsx` from install.sh — not part of every container start).
COPY --from=builder /app/scripts ./scripts

# Next.js standalone server output. Copied selectively (not the whole
# `.next/standalone` dir) to avoid two conflicting node_modules trees — this
# image's node_modules comes from `npm ci --omit=dev` above, not from
# standalone's own traced/bundled copy.
COPY --from=builder /app/.next/standalone/server.js ./server.js
COPY --from=builder /app/.next/standalone/.next ./.next
# Runtime-loaded locale JSON files (src/locales/*.json, read from disk by
# i18next at request time, not just bundled) — Next's tracer pulled these into
# .next/standalone/src; verified manually against this build.
COPY --from=builder /app/.next/standalone/src ./src
COPY --from=builder /app/.next/static ./.next/static

# Standalone mode does NOT copy public/ automatically — must be explicit, or
# uploaded logos/photos and static assets silently 404 (R-3 in the deploy plan).
# The public/uploads subpath is overlaid by a volume mount at runtime (AD-5) —
# this COPY only matters for first boot / non-uploaded static assets.
COPY --from=builder /app/public ./public

COPY deploy/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]

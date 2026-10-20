#!/bin/sh
set -e

echo "[Banking API] Applying database migrations..."
npx prisma migrate deploy

echo "[Banking API] Starting production server on port ${PORT:-3000}..."
exec node dist/main.js

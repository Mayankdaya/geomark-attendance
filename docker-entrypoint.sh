#!/bin/sh
# Container startup: make sure the SQLite DB exists and matches the schema,
# seed demo data on first boot, then serve the production build.
# The host must mount persistent storage at /app/db (see render.yaml).
set -e

echo "==> Syncing database schema..."
npx prisma db push --skip-generate

echo "==> Seeding demo data (script skips if data already exists)..."
node prisma/seed.ts || echo "seed step failed, continuing anyway"

echo "==> Starting GeoMark (production)..."
exec npx next start -H 0.0.0.0

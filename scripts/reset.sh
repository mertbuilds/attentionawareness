#!/usr/bin/env bash
# Reset local database to a clean seeded state. Safe to run anytime.
# Emulate state is in-memory — restart the emulate process to reset it; nothing to wipe here.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi
export DATABASE_URL="${DATABASE_URL:-postgresql://webstarter:webstarter@localhost:5433/webstarter}"

echo "» Dropping postgres volume..."
docker compose down --volumes

echo "» Starting postgres..."
docker compose up --detach --wait postgres

echo "» Generating Prisma client..."
pnpm --filter @web-starter/db generate

echo "» Applying migrations..."
pnpm --filter @web-starter/db migrate

echo "» Seeding..."
pnpm --filter @web-starter/db seed

echo "✓ Database reset complete."

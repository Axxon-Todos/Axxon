#!/bin/sh
# Updates the production checkout, rebuilds the release images, applies migrations, and restarts the app stack.
set -eu

cd "$(dirname "$0")/.."

compose_cmd="docker compose --env-file .env.production -f docker-compose.prod.yml"

git fetch --all --prune
git checkout main
git pull --ff-only

$compose_cmd build app ws migrate
$compose_cmd up -d db redis
$compose_cmd stop app ws || true
$compose_cmd run --rm migrate
$compose_cmd up -d app ws

#!/bin/sh
# Runs docker compose for local development with a required .env.local file and an optional .env.docker override.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$PROJECT_ROOT"

if [ -f .env.docker ]; then
  exec docker compose --env-file .env.local --env-file .env.docker "$@"
fi

exec docker compose --env-file .env.local "$@"

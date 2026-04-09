#!/bin/sh
# Recreates the local Docker development stack and resets the persisted Postgres volume.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR/.."

sh ./scripts/docker-dev-compose.sh down --remove-orphans

if docker volume inspect axxon_postgres_data >/dev/null 2>&1; then
  docker volume rm axxon_postgres_data >/dev/null
fi

sh ./scripts/docker-dev-compose.sh up --build -d

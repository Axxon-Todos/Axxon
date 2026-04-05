#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR/.."

docker compose --env-file .env.local --env-file .env.docker down --remove-orphans

if docker volume inspect axxon_postgres_data >/dev/null 2>&1; then
  docker volume rm axxon_postgres_data >/dev/null
fi

docker compose --env-file .env.local --env-file .env.docker up --build -d

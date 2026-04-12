#!/bin/sh
# Keeps the dev container dependency volume aligned with package.json and pnpm-lock.yaml before starting the requested process.
set -eu

fingerprint_file="/app/node_modules/.axxon-deps-fingerprint"
current_fingerprint="$(sha256sum /app/package.json /app/pnpm-lock.yaml | sha256sum | awk '{ print $1 }')"
installed_fingerprint=""

if [ -f "$fingerprint_file" ]; then
  installed_fingerprint="$(cat "$fingerprint_file")"
fi

if [ ! -d /app/node_modules/.pnpm ] || [ "$current_fingerprint" != "$installed_fingerprint" ]; then
  echo "Refreshing container dependencies..."
  CI=true pnpm install --frozen-lockfile --config.confirmModulesPurge=false
  mkdir -p /app/node_modules
  printf '%s' "$current_fingerprint" > "$fingerprint_file"
fi

exec "$@"

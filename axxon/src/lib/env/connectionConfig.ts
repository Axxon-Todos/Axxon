// Centralizes runtime environment parsing for Postgres, Redis, and client-origin connection settings.
import type { Knex } from 'knex';

import { loadRuntimeEnv } from './loadRuntimeEnv';

loadRuntimeEnv();

const DEFAULT_POSTGRES_PORT = 5432;
const DEFAULT_REDIS_URL = 'redis://localhost:6379';
const DEFAULT_CLIENT_ORIGINS = ['http://127.0.0.1:3000', 'http://localhost:3000'];
type PostgresConnectionConfig = string | Knex.PgConnectionConfig;

type PostgresConnectionOverrides = {
  connectionString?: string | null;
  database?: string | null;
  host?: string | null;
  password?: string | null;
  port?: number | null;
  user?: string | null;
};

// Normalize integer env values once so downstream callers do not repeat parse logic.
export function getPostgresPort(defaultPort = DEFAULT_POSTGRES_PORT) {
  const configuredPort = process.env.PG_PORT?.trim();
  const parsedPort = configuredPort ? Number(configuredPort) : Number.NaN;

  return Number.isFinite(parsedPort) ? parsedPort : defaultPort;
}

// Resolve the current Postgres connection config from envs, with optional per-call overrides.
export function getPostgresConnectionConfig(
  overrides: PostgresConnectionOverrides = {}
): PostgresConnectionConfig {
  const connectionString =
    overrides.connectionString ?? process.env.PG_CONNECTION_STRING?.trim();

  if (connectionString) {
    return connectionString;
  }

  return {
    host: overrides.host ?? process.env.PG_HOST,
    port: overrides.port ?? getPostgresPort(),
    user: overrides.user ?? process.env.PG_USER,
    password: overrides.password ?? process.env.PG_PASS,
    database: overrides.database ?? process.env.PG_DB,
  };
}

// Surface the optional bootstrap fallback host without duplicating raw env access.
export function getPostgresFallbackHost() {
  const fallbackHost = process.env.PG_HOST_FALLBACK?.trim();
  return fallbackHost && fallbackHost.length > 0 ? fallbackHost : null;
}

// Build a human-readable Postgres target string for logs and connection diagnostics.
export function describePostgresConnectionTarget(
  overrides: PostgresConnectionOverrides = {}
) {
  const connection = getPostgresConnectionConfig(overrides);

  if (typeof connection === 'string') {
    if (connection.length === 0) {
      return '[invalid PG_CONNECTION_STRING]';
    }

    try {
      const url = new URL(connection);
      const databaseName = url.pathname.replace(/^\//, '') || '(default)';
      const port = url.port || String(DEFAULT_POSTGRES_PORT);

      return `${url.protocol}//${url.hostname}:${port}/${databaseName}`;
    } catch {
      return '[invalid PG_CONNECTION_STRING]';
    }
  }

  const objectConnection = connection;
  const databaseName =
    typeof objectConnection.database === 'string' && objectConnection.database.length > 0
      ? objectConnection.database
      : '(missing-db)';
  const host =
    typeof objectConnection.host === 'string' && objectConnection.host.length > 0
      ? objectConnection.host
      : '(missing-host)';
  const port =
    typeof objectConnection.port === 'number'
      ? String(objectConnection.port)
      : String(DEFAULT_POSTGRES_PORT);

  return `${host}:${port}/${databaseName}`;
}

// Resolve the runtime Redis URL with an optional fallback for local or test-only callers.
export function getRedisUrl(defaultUrl = DEFAULT_REDIS_URL) {
  const configuredUrl = process.env.REDIS_URL?.trim();
  return configuredUrl && configuredUrl.length > 0 ? configuredUrl : defaultUrl;
}

// Parse the allowed browser origins that may connect to the websocket service.
export function getConfiguredClientOrigins(
  fallbackOrigins = DEFAULT_CLIENT_ORIGINS
) {
  const configuredOrigins = [process.env.CLIENT_URL, process.env.NEXT_PUBLIC_HOSTNAME]
    .flatMap((value) => (value ? value.split(',') : []))
    .map((entry) => entry.trim())
    .filter(Boolean);

  const normalizedOrigins = configuredOrigins.map((entry) => {
    try {
      return new URL(entry).origin;
    } catch {
      return null;
    }
  });

  const uniqueOrigins = Array.from(
    new Set(normalizedOrigins.filter(Boolean))
  ) as string[];

  return uniqueOrigins.length > 0 ? uniqueOrigins : fallbackOrigins;
}

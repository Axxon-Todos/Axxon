// Loads runtime environment variables before exposing Knex configs for local and Docker workflows.
import path from 'node:path';
import type { Knex } from 'knex';
import { loadRuntimeEnv } from './src/lib/env/loadRuntimeEnv';

loadRuntimeEnv();

const directoryConfig = {
  migrations: {
    directory: path.join(__dirname, 'src', 'lib', 'db', 'migrations'),
  },
  seeds: {
    directory: path.join(__dirname, 'src', 'lib', 'db', 'seeds'),
  },
} as const;

const config: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_STRING || {
      host: process.env.PG_HOST,
      port: process.env.PG_PORT ? Number(process.env.PG_PORT) : undefined,
      user: process.env.PG_USER,
      password: process.env.PG_PASS,
      database: process.env.PG_DB,
    },
    ...directoryConfig,
  },
  production: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_STRING,
    ...directoryConfig,
  },
};

export default config;

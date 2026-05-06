// Loads runtime environment variables before exposing Knex configs for local and Docker workflows.
import path from 'node:path';
import type { Knex } from 'knex';
import { getPostgresConnectionConfig } from './src/lib/env/connectionConfig';

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
    connection: getPostgresConnectionConfig(),
    ...directoryConfig,
  },
  test: {
    client: 'pg',
    connection: getPostgresConnectionConfig(),
    ...directoryConfig,
  },
  production: {
    client: 'pg',
    connection: getPostgresConnectionConfig(),
    ...directoryConfig,
  },
};

export default config;

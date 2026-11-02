// Provides the shared application Knex client and bounded Postgres pool.
'use server';

import knex from 'knex';
import type { Knex } from 'knex';
import {
  getPostgresConnectionConfig,
  getPostgresPoolConfig,
} from '../env/connectionConfig';

const config: Knex.Config = {
  client: 'pg',
  connection: getPostgresConnectionConfig(),
  pool: getPostgresPoolConfig(),
  acquireConnectionTimeout: 10_000,
  migrations: {
    directory: './migrations',
    extension: 'ts',
  },
};

type GlobalDatabaseState = typeof globalThis & {
  __axxonDb?: Knex;
};

const globalDatabaseState = globalThis as GlobalDatabaseState;

// Reuses the client across Next.js and tsx development reloads instead of leaking pools.
const db = globalDatabaseState.__axxonDb ?? knex(config);

if (process.env.NODE_ENV !== 'production') {
  globalDatabaseState.__axxonDb = db;
}

export default db;

// Prepares the backend test database and migration state before Vitest starts.
import path from 'node:path';
import 'tsx/cjs';
import knex from 'knex';
import type { Knex } from 'knex';

import { getPostgresConnectionConfig } from '@/lib/env/connectionConfig';

import { applyBackendTestEnv, getBackendTestDbConfig } from './env';

// Create the backend test Knex client from the same shared Postgres env parser used at runtime.
function createTestKnex(): Knex {
  return knex({
    client: 'pg',
    connection: getPostgresConnectionConfig(),
  });
}

export default async function globalSetup() {
  applyBackendTestEnv();

  const dbConfig = getBackendTestDbConfig();

  // Knex loads migrations through CommonJS in the backend test bootstrap.
  // `tsx/cjs` is already registered above so TypeScript migration files can be required.

  const adminDb = knex({
    client: 'pg',
    connection: dbConfig.adminConnectionString,
  });

  try {
    const existingDatabase = await adminDb('pg_database')
      .where({ datname: dbConfig.database })
      .first();

    if (!existingDatabase) {
      const escapedDatabaseName = dbConfig.database.replace(/"/g, '""');
      await adminDb.raw(`CREATE DATABASE "${escapedDatabaseName}"`);
    }
  } finally {
    await adminDb.destroy();
  }

  const db = createTestKnex();
  await db.migrate.latest({
    directory: path.resolve(__dirname, '../../lib/db/migrations'),
    extension: 'ts',
  });

  return async () => {
    await db.destroy();
  };
}

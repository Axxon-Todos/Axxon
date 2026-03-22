import path from 'node:path';
import 'tsx/cjs';
import knex from 'knex';
import type { Knex } from 'knex';

import { applyBackendTestEnv, getBackendTestDbConfig } from './env';

function createTestKnex(): Knex {
  return knex({
    client: 'pg',
    connection: process.env.PG_CONNECTION_STRING || {
      host: process.env.PG_HOST,
      port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5432,
      user: process.env.PG_USER,
      password: process.env.PG_PASS,
      database: process.env.PG_DB,
    },
  });
}

export default async function globalSetup() {
  applyBackendTestEnv();

  const dbConfig = getBackendTestDbConfig();

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

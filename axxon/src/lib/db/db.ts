'use server';

import knex from 'knex';
import type { Knex } from 'knex';
import { loadRuntimeEnv } from '../env/loadRuntimeEnv';

loadRuntimeEnv();

const config: Knex.Config = {
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING || {
    host: process.env.PG_HOST,
    port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASS,
    database: process.env.PG_DB,
  },
  migrations: {
    directory: './migrations',
    extension: 'ts',
  },
};

const db = knex(config);

export default db;

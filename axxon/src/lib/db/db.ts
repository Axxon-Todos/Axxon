'use server';

import dotenv from 'dotenv';
import knex, { Knex } from 'knex';

// Load the same local env values for standalone processes like the WS server.
dotenv.config({ path: '.env.local' });
dotenv.config();

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

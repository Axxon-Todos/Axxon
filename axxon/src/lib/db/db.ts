'use server';

import knex from 'knex';
import type { Knex } from 'knex';
import { getPostgresConnectionConfig } from '../env/connectionConfig';

const config: Knex.Config = {
  client: 'pg',
  connection: getPostgresConnectionConfig(),
  migrations: {
    directory: './migrations',
    extension: 'ts',
  },
};

const db = knex(config);

export default db;

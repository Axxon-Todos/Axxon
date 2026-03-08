import Redis from 'ioredis';
import knex from 'knex';

import { applyBackendTestEnv, getBackendTestDbConfig } from './env';

type PgRoleRow = {
  rolcreatedb: boolean;
  rolsuper: boolean;
};

function asError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function formatPgTarget() {
  const dbConfig = getBackendTestDbConfig();
  return `${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
}

function formatPgConnectionError(error: unknown) {
  const resolvedError = asError(error) as Error & { code?: string };
  const target = formatPgTarget();

  switch (resolvedError.code) {
    case 'ECONNREFUSED':
    case 'EPERM':
      return `Postgres is not reachable at ${target}. Start your local Postgres container or update your backend test env.`;
    case 'ENOTFOUND':
      return `Postgres host "${getBackendTestDbConfig().host}" could not be resolved. Check your PG_HOST or PG_CONNECTION_STRING values.`;
    case '28P01':
      return `Postgres rejected the backend test credentials for ${target}. Check PG_USER and PG_PASS in your env files.`;
    default:
      return `Failed to connect to Postgres at ${target}: ${resolvedError.message}`;
  }
}

function formatRedisConnectionError(error: unknown) {
  const resolvedError = asError(error) as Error & { code?: string };
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

  switch (resolvedError.code) {
    case 'ECONNREFUSED':
    case 'EPERM':
      return `Redis is not reachable at ${redisUrl}. Start your local Redis container or update REDIS_URL.`;
    case 'ENOTFOUND':
      return `Redis host in ${redisUrl} could not be resolved. Check REDIS_URL.`;
    default:
      return `Failed to connect to Redis at ${redisUrl}: ${resolvedError.message}`;
  }
}

async function verifyPostgres() {
  const dbConfig = getBackendTestDbConfig();
  const adminDb = knex({
    client: 'pg',
    connection: dbConfig.adminConnectionString,
  });

  try {
    await adminDb.raw('SELECT 1');
  } catch (error) {
    await adminDb.destroy().catch(() => undefined);
    throw new Error(formatPgConnectionError(error));
  }

  try {
    const existingDatabase = await adminDb('pg_database')
      .select('datname')
      .where({ datname: dbConfig.database })
      .first();

    if (existingDatabase) {
      return;
    }

    const role = await adminDb<PgRoleRow>('pg_roles')
      .select('rolcreatedb', 'rolsuper')
      .whereRaw('rolname = current_user')
      .first();

    if (role?.rolcreatedb || role?.rolsuper) {
      return;
    }

    throw new Error(
      `Backend test database "${dbConfig.database}" does not exist, and the current Postgres user cannot create databases. Create it manually or grant CREATEDB.`
    );
  } finally {
    await adminDb.destroy().catch(() => undefined);
  }
}

async function verifyRedis() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
  });

  try {
    await redis.connect();
    await redis.ping();
  } catch (error) {
    throw new Error(formatRedisConnectionError(error));
  } finally {
    await redis.quit().catch(() => {
      redis.disconnect();
    });
  }
}

async function main() {
  applyBackendTestEnv();

  await verifyPostgres();
  await verifyRedis();

  const dbConfig = getBackendTestDbConfig();
  process.stdout.write(
    `Backend test preflight passed. Using Postgres ${dbConfig.database} and Redis ${process.env.REDIS_URL}.\n`
  );
}

main().catch((error) => {
  const resolvedError = asError(error);
  process.stderr.write(`${resolvedError.message}\n`);
  process.exit(1);
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'NODE_ENV',
  'JWT_SECRET',
  'PG_HOST',
  'PG_PORT',
  'PG_USER',
  'PG_PASS',
  'PG_DB',
  'PG_CONNECTION_STRING',
  'PG_TEST_HOST',
  'PG_TEST_PORT',
  'PG_TEST_USER',
  'PG_TEST_PASS',
  'PG_TEST_DB',
  'PG_TEST_CONNECTION_STRING',
  'PG_TEST_ADMIN_DB',
  'REDIS_URL',
  'CLIENT_URL',
  'NEXT_PUBLIC_WS_URL',
  'AXXON_BACKEND_TEST_SOURCE_ADMIN_DB',
  'AXXON_BACKEND_TEST_SOURCE_CONNECTION_STRING',
  'AXXON_BACKEND_TEST_SOURCE_DB',
  'AXXON_BACKEND_TEST_SOURCE_HOST',
  'AXXON_BACKEND_TEST_SOURCE_PASS',
  'AXXON_BACKEND_TEST_SOURCE_PORT',
  'AXXON_BACKEND_TEST_SOURCE_USER',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];
type EnvSnapshot = Record<EnvKey, string | undefined>;

function snapshotEnv(): EnvSnapshot {
  return Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]])
  ) as EnvSnapshot;
}

function restoreEnv(snapshot: EnvSnapshot) {
  const env = process.env as Record<string, string | undefined>;

  for (const key of ENV_KEYS) {
    const value = snapshot[key];

    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    env[key] = value;
  }
}

function clearPersistedSourceEnv() {
  delete process.env.AXXON_BACKEND_TEST_SOURCE_ADMIN_DB;
  delete process.env.AXXON_BACKEND_TEST_SOURCE_CONNECTION_STRING;
  delete process.env.AXXON_BACKEND_TEST_SOURCE_DB;
  delete process.env.AXXON_BACKEND_TEST_SOURCE_HOST;
  delete process.env.AXXON_BACKEND_TEST_SOURCE_PASS;
  delete process.env.AXXON_BACKEND_TEST_SOURCE_PORT;
  delete process.env.AXXON_BACKEND_TEST_SOURCE_USER;
}

async function loadEnvModule() {
  vi.resetModules();
  return import('./env');
}

describe('backend test env', () => {
  let originalEnv: EnvSnapshot;

  beforeEach(() => {
    originalEnv = snapshotEnv();
  });

  afterEach(() => {
    restoreEnv(originalEnv);
  });

  it('derives a single _test suffix from PG_DB', async () => {
    clearPersistedSourceEnv();
    process.env.PG_HOST = '127.0.0.1';
    process.env.PG_PORT = '5432';
    process.env.PG_USER = 'postgres';
    process.env.PG_PASS = 'marcy';
    process.env.PG_DB = 'postgres';

    const { getBackendTestDbConfig } = await loadEnvModule();
    const config = getBackendTestDbConfig();

    expect(config.database).toBe('postgres_test');
    expect(config.connectionString).toContain('/postgres_test');
  });

  it('keeps an inherited test database name stable across reloads', async () => {
    clearPersistedSourceEnv();
    process.env.PG_HOST = '127.0.0.1';
    process.env.PG_PORT = '5432';
    process.env.PG_USER = 'postgres';
    process.env.PG_PASS = 'marcy';
    process.env.PG_DB = 'postgres_test';
    process.env.PG_CONNECTION_STRING = 'postgresql://postgres:marcy@127.0.0.1:5432/postgres_test';

    const firstModule = await loadEnvModule();
    firstModule.applyBackendTestEnv();

    expect(process.env.PG_DB).toBe('postgres_test');
    expect(process.env.PG_CONNECTION_STRING).toBe(
      'postgresql://postgres:marcy@127.0.0.1:5432/postgres_test'
    );

    const secondModule = await loadEnvModule();
    const config = secondModule.getBackendTestDbConfig();

    expect(config.database).toBe('postgres_test');
    expect(config.connectionString).toBe(
      'postgresql://postgres:marcy@127.0.0.1:5432/postgres_test'
    );
    expect(process.env.PG_TEST_DB).toBeUndefined();
    expect(process.env.PG_TEST_CONNECTION_STRING).toBeUndefined();
  });

  it('prefers explicit PG_TEST_* values without mutating them back into process env', async () => {
    clearPersistedSourceEnv();
    process.env.PG_HOST = 'localhost';
    process.env.PG_PORT = '5432';
    process.env.PG_USER = 'postgres';
    process.env.PG_PASS = 'marcy';
    process.env.PG_DB = 'postgres';
    process.env.PG_TEST_DB = 'axxon_test';
    process.env.PG_TEST_CONNECTION_STRING =
      'postgresql://postgres:marcy@127.0.0.1:5432/axxon_test';

    const { applyBackendTestEnv, getBackendTestDbConfig } = await loadEnvModule();
    const config = getBackendTestDbConfig();

    expect(config.database).toBe('axxon_test');

    applyBackendTestEnv();

    expect(process.env.PG_DB).toBe('axxon_test');
    expect(process.env.PG_CONNECTION_STRING).toBe(
      'postgresql://postgres:marcy@127.0.0.1:5432/axxon_test'
    );
    expect(process.env.PG_TEST_DB).toBe('axxon_test');
    expect(process.env.PG_TEST_CONNECTION_STRING).toBe(
      'postgresql://postgres:marcy@127.0.0.1:5432/axxon_test'
    );
  });
});

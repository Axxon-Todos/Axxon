// Verifies the shared connection env helpers normalize Postgres, Redis, and websocket origin config.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getConfiguredClientOrigins,
  getPostgresConnectionConfig,
  getPostgresFallbackHost,
  getRedisUrl,
} from '@/lib/env/connectionConfig';

const CONNECTION_ENV_KEYS = [
  'PG_CONNECTION_STRING',
  'PG_HOST',
  'PG_PORT',
  'PG_USER',
  'PG_PASS',
  'PG_DB',
  'PG_HOST_FALLBACK',
  'REDIS_URL',
  'CLIENT_URL',
  'NEXT_PUBLIC_HOSTNAME',
] as const;

const originalEnvValues = new Map(
  CONNECTION_ENV_KEYS.map((key) => [key, process.env[key]])
);

describe('connectionConfig', () => {
  beforeEach(() => {
    for (const key of CONNECTION_ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of CONNECTION_ENV_KEYS) {
      const originalValue = originalEnvValues.get(key);

      if (typeof originalValue === 'string') {
        process.env[key] = originalValue;
      } else {
        delete process.env[key];
      }
    }
  });

  it('prefers PG_CONNECTION_STRING when it is configured', () => {
    process.env.PG_CONNECTION_STRING =
      'postgresql://postgres:postgres@127.0.0.1:5432/axxon';

    expect(getPostgresConnectionConfig()).toBe(
      'postgresql://postgres:postgres@127.0.0.1:5432/axxon'
    );
  });

  it('builds a Postgres connection object from discrete PG_* envs', () => {
    process.env.PG_HOST = 'db.internal';
    process.env.PG_PORT = '6543';
    process.env.PG_USER = 'axxon';
    process.env.PG_PASS = 'secret';
    process.env.PG_DB = 'axxon_prod';

    expect(getPostgresConnectionConfig()).toEqual({
      host: 'db.internal',
      port: 6543,
      user: 'axxon',
      password: 'secret',
      database: 'axxon_prod',
    });
  });

  it('returns the configured fallback Postgres host when present', () => {
    process.env.PG_HOST_FALLBACK = 'host.docker.internal';

    expect(getPostgresFallbackHost()).toBe('host.docker.internal');
  });

  it('falls back to the provided Redis default when REDIS_URL is unset', () => {
    expect(getRedisUrl('redis://127.0.0.1:6380')).toBe('redis://127.0.0.1:6380');
  });

  it('normalizes and de-duplicates configured websocket origins', () => {
    process.env.CLIENT_URL = 'http://localhost:3000, https://axxon.example.com/app';
    process.env.NEXT_PUBLIC_HOSTNAME =
      'https://axxon.example.com, http://localhost:3000';

    expect(getConfiguredClientOrigins()).toEqual([
      'http://localhost:3000',
      'https://axxon.example.com',
    ]);
  });
});

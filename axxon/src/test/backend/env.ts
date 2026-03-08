import dotenv from 'dotenv';

dotenv.config({ path: '.env.test.local' });
dotenv.config({ path: '.env.local' });
dotenv.config();

const TEST_DB_SUFFIX = '_test';

type BackendTestDbConfig = {
  adminConnectionString: string;
  connectionString: string;
  database: string;
  host: string;
  port: string;
  user: string;
  password: string;
};

type BackendTestSourceEnv = {
  adminDatabase?: string;
  connectionString?: string;
  database?: string;
  host?: string;
  password?: string;
  port?: string;
  user?: string;
};

function readEnvValue(value: string | undefined) {
  return value === 'undefined' ? undefined : value;
}

function normalizeTestDatabaseName(database: string) {
  return database.endsWith(TEST_DB_SUFFIX)
    ? database
    : `${database}${TEST_DB_SUFFIX}`;
}

function getPersistedSourceEnv(): BackendTestSourceEnv | null {
  const env = process.env as Record<string, string | undefined>;
  const sourceEnv: BackendTestSourceEnv = {
    adminDatabase: readEnvValue(env.AXXON_BACKEND_TEST_SOURCE_ADMIN_DB),
    connectionString: readEnvValue(env.AXXON_BACKEND_TEST_SOURCE_CONNECTION_STRING),
    database: readEnvValue(env.AXXON_BACKEND_TEST_SOURCE_DB),
    host: readEnvValue(env.AXXON_BACKEND_TEST_SOURCE_HOST),
    password: readEnvValue(env.AXXON_BACKEND_TEST_SOURCE_PASS),
    port: readEnvValue(env.AXXON_BACKEND_TEST_SOURCE_PORT),
    user: readEnvValue(env.AXXON_BACKEND_TEST_SOURCE_USER),
  };

  return Object.values(sourceEnv).some(Boolean) ? sourceEnv : null;
}

function persistSourceEnv(sourceEnv: BackendTestSourceEnv) {
  const env = process.env as Record<string, string | undefined>;

  if (sourceEnv.adminDatabase !== undefined) {
    env.AXXON_BACKEND_TEST_SOURCE_ADMIN_DB ??= sourceEnv.adminDatabase;
  }
  if (sourceEnv.connectionString !== undefined) {
    env.AXXON_BACKEND_TEST_SOURCE_CONNECTION_STRING ??= sourceEnv.connectionString;
  }
  if (sourceEnv.database !== undefined) {
    env.AXXON_BACKEND_TEST_SOURCE_DB ??= sourceEnv.database;
  }
  if (sourceEnv.host !== undefined) {
    env.AXXON_BACKEND_TEST_SOURCE_HOST ??= sourceEnv.host;
  }
  if (sourceEnv.password !== undefined) {
    env.AXXON_BACKEND_TEST_SOURCE_PASS ??= sourceEnv.password;
  }
  if (sourceEnv.port !== undefined) {
    env.AXXON_BACKEND_TEST_SOURCE_PORT ??= sourceEnv.port;
  }
  if (sourceEnv.user !== undefined) {
    env.AXXON_BACKEND_TEST_SOURCE_USER ??= sourceEnv.user;
  }
}

function getSourceEnv(): BackendTestSourceEnv {
  const persistedSourceEnv = getPersistedSourceEnv();
  if (persistedSourceEnv) {
    return persistedSourceEnv;
  }

  const env = process.env as Record<string, string | undefined>;
  const sourceEnv: BackendTestSourceEnv = {
    adminDatabase: env.PG_TEST_ADMIN_DB,
    connectionString: env.PG_TEST_CONNECTION_STRING ?? env.PG_CONNECTION_STRING,
    database: env.PG_TEST_DB ?? env.PG_DB,
    host: env.PG_TEST_HOST ?? env.PG_HOST,
    password: env.PG_TEST_PASS ?? env.PG_PASS,
    port: env.PG_TEST_PORT ?? env.PG_PORT,
    user: env.PG_TEST_USER ?? env.PG_USER,
  };

  persistSourceEnv(sourceEnv);

  return sourceEnv;
}

function toConnectionString(params: {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}) {
  const url = new URL('postgresql://localhost');
  url.hostname = params.host;
  url.port = params.port;
  url.username = params.user;
  url.password = params.password;
  url.pathname = `/${params.database}`;
  return url.toString();
}

export function getBackendTestDbConfig(): BackendTestDbConfig {
  const sourceEnv = getSourceEnv();
  const connectionStringSource = sourceEnv.connectionString;

  if (connectionStringSource) {
    const baseUrl = new URL(connectionStringSource);
    const baseDatabase =
      sourceEnv.database ?? (baseUrl.pathname.replace(/^\//, '') || 'postgres');
    const testDatabase = normalizeTestDatabaseName(baseDatabase);
    const adminDatabase = sourceEnv.adminDatabase ?? 'postgres';

    const testUrl = new URL(baseUrl.toString());
    testUrl.pathname = `/${testDatabase}`;

    const adminUrl = new URL(baseUrl.toString());
    adminUrl.pathname = `/${adminDatabase}`;

    return {
      adminConnectionString: adminUrl.toString(),
      connectionString: testUrl.toString(),
      database: testDatabase,
      host: testUrl.hostname,
      port: testUrl.port || '5432',
      user: decodeURIComponent(testUrl.username),
      password: decodeURIComponent(testUrl.password),
    };
  }

  const host = sourceEnv.host ?? '127.0.0.1';
  const port = sourceEnv.port ?? '5432';
  const user = sourceEnv.user ?? 'postgres';
  const password = sourceEnv.password ?? 'postgres';
  const baseDatabase = sourceEnv.database ?? 'postgres';
  const database = normalizeTestDatabaseName(baseDatabase);
  const adminDatabase = sourceEnv.adminDatabase ?? 'postgres';

  return {
    adminConnectionString: toConnectionString({
      host,
      port,
      user,
      password,
      database: adminDatabase,
    }),
    connectionString: toConnectionString({
      host,
      port,
      user,
      password,
      database,
    }),
    database,
    host,
    port,
    user,
    password,
  };
}

export function applyBackendTestEnv() {
  const env = process.env as Record<string, string | undefined>;
  const dbConfig = getBackendTestDbConfig();

  env.NODE_ENV = 'test';
  env.JWT_SECRET ??= 'test-jwt-secret';
  env.PG_HOST = dbConfig.host;
  env.PG_PORT = dbConfig.port;
  env.PG_USER = dbConfig.user;
  env.PG_PASS = dbConfig.password;
  env.PG_DB = dbConfig.database;
  env.PG_CONNECTION_STRING = dbConfig.connectionString;
  env.REDIS_URL ??= 'redis://127.0.0.1:6379';
  env.CLIENT_URL ??= 'http://127.0.0.1:3000';
  env.NEXT_PUBLIC_WS_URL ??= 'http://127.0.0.1:4000';
}

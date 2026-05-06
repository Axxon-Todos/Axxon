// Boots the development database by waiting for Postgres, applying migrations, and seeding fresh instances.
import { spawnSync } from "child_process";
import { setTimeout as delay } from "timers/promises";
import knex from "knex";
import type { Knex } from "knex";
import {
  describePostgresConnectionTarget,
  getPostgresConnectionConfig,
  getPostgresFallbackHost,
  getPostgresPort,
} from "../../env/connectionConfig";

const WAIT_INTERVAL_MS = 2000;
const MAX_WAIT_ATTEMPTS = 30;
const PRIMARY_DB_HOST = process.env.PG_HOST;
const FALLBACK_DB_HOST = getPostgresFallbackHost();
let activeDbHost = PRIMARY_DB_HOST;

function createConnectionConfig(): Knex.Config {
  return {
    client: "pg",
    connection: getPostgresConnectionConfig({
      host: activeDbHost,
      port: getPostgresPort(),
    }),
  };
}

function createDbConnection() {
  return knex(createConnectionConfig());
}

function isHostnameLookupError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOTFOUND"
  );
}

function canUseFallbackHost() {
  return Boolean(
    !process.env.PG_CONNECTION_STRING &&
      FALLBACK_DB_HOST &&
      PRIMARY_DB_HOST &&
      activeDbHost === PRIMARY_DB_HOST,
  );
}

function switchToFallbackHost() {
  if (!FALLBACK_DB_HOST) {
    return false;
  }

  activeDbHost = FALLBACK_DB_HOST;
  process.env.PG_HOST = activeDbHost;
  console.warn(
    `[db:bootstrap] Falling back to Postgres host "${activeDbHost}" after DNS lookup failed for "${PRIMARY_DB_HOST}".`,
  );
  return true;
}

function describeConnectionTarget() {
  return describePostgresConnectionTarget({
    host: activeDbHost,
    port: getPostgresPort(),
  });
}

async function waitForDatabase() {
  for (let attempt = 1; attempt <= MAX_WAIT_ATTEMPTS; attempt += 1) {
    const db = createDbConnection();
    let ready = false;

    try {
      await db.raw("select 1");
      ready = true;
    } catch (error) {
      if (isHostnameLookupError(error) && canUseFallbackHost() && switchToFallbackHost()) {
        console.log("[db:bootstrap] Retrying Postgres connection with fallback host.");
        continue;
      }

      if (attempt === MAX_WAIT_ATTEMPTS) {
        throw error;
      }

      console.log(
        `[db:bootstrap] Waiting for Postgres (${attempt}/${MAX_WAIT_ATTEMPTS})...`,
      );
    } finally {
      await db.destroy();
    }

    if (ready) {
      console.log(`[db:bootstrap] Postgres is ready on attempt ${attempt}.`);
      return;
    }

    await delay(WAIT_INTERVAL_MS);
  }
}

async function isFreshDatabase() {
  const db = createDbConnection();

  try {
    return !(await db.schema.hasTable("knex_migrations"));
  } finally {
    await db.destroy();
  }
}

function runPnpmScript(script: string) {
  console.log(`[db:bootstrap] Running pnpm ${script}...`);

  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, [script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`pnpm ${script} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

async function main() {
  console.log(`[db:bootstrap] Using Postgres target ${describeConnectionTarget()}.`);
  await waitForDatabase();

  const freshDatabase = await isFreshDatabase();

  if (freshDatabase) {
    console.log("[db:bootstrap] Fresh database detected. Running migrations and seed.");
  } else {
    console.log("[db:bootstrap] Existing database detected. Running migrations only.");
  }

  runPnpmScript("migrate:latest");

  if (freshDatabase) {
    runPnpmScript("seed");
  } else {
    console.log("[db:bootstrap] Seed skipped because the database is already initialized.");
  }

  console.log("[db:bootstrap] Database bootstrap complete.");
}

main().catch((error) => {
  console.error("[db:bootstrap] Database bootstrap failed.", error);
  process.exit(1);
});

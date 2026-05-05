// Adds persisted planning run records so async executor state is tracked independently from transcript messages.
import type { Knex } from 'knex';

export const config = {
  transaction: false,
};

const PLANNING_SESSION_STATE = 'planning_session_state';
const PLANNING_RUN_STATE = 'planning_run_state';
const PLANNING_RUN_STAGE = 'planning_run_stage';
const PLANNING_EXECUTOR_KIND = 'planning_executor_kind';

async function addEnumValueIfMissing(
  knex: Knex,
  enumName: string,
  value: string
) {
  await knex.raw(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`);
}

async function createEnumTypeIfMissing(
  knex: Knex,
  enumName: string,
  values: string[]
) {
  await knex.raw(`
    DO $$
    BEGIN
      CREATE TYPE "${enumName}" AS ENUM (${values.map((value) => `'${value}'`).join(', ')});
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $$;
  `);
}

export async function up(knex: Knex): Promise<void> {
  await addEnumValueIfMissing(knex, PLANNING_SESSION_STATE, 'queued');

  await createEnumTypeIfMissing(knex, PLANNING_RUN_STATE, [
    'queued',
    'running',
    'waiting_for_clarification',
    'completed',
    'failed',
    'cancelled',
  ]);
  await createEnumTypeIfMissing(knex, PLANNING_RUN_STAGE, [
    'queued',
    'analyzing',
    'clarifying',
    'planning',
    'completed',
    'failed',
  ]);
  await createEnumTypeIfMissing(knex, PLANNING_EXECUTOR_KIND, [
    'local_ollama',
    'external_llm',
    'headless_agent',
  ]);

  await knex.schema.createTable('planning_runs', (table) => {
    table.increments('id').primary();
    table
      .integer('session_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('planning_sessions')
      .onDelete('CASCADE');
    table
      .integer('trigger_message_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('planning_session_messages')
      .onDelete('CASCADE');
    table
      .integer('status_message_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('planning_session_messages')
      .onDelete('CASCADE');
    table
      .specificType('executor_kind', `"${PLANNING_EXECUTOR_KIND}"`)
      .notNullable()
      .defaultTo('local_ollama');
    table
      .specificType('state', `"${PLANNING_RUN_STATE}"`)
      .notNullable()
      .defaultTo('queued');
    table
      .specificType('stage', `"${PLANNING_RUN_STAGE}"`)
      .notNullable()
      .defaultTo('queued');
    table.integer('attempt_count').notNullable().defaultTo(0);
    table.string('provider_job_id').nullable();
    table.jsonb('metadata_json').nullable();
    table.text('error_message').nullable();
    table.timestamp('started_at').nullable();
    table.timestamp('finished_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['session_id', 'created_at']);
    table.index(['state', 'updated_at']);
  });

  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS planning_runs_one_active_per_session ON planning_runs (session_id) WHERE state IN ('queued', 'running')`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS planning_runs_one_active_per_session');
  await knex.schema.dropTableIfExists('planning_runs');
  await knex.raw(`DROP TYPE IF EXISTS "${PLANNING_EXECUTOR_KIND}"`);
  await knex.raw(`DROP TYPE IF EXISTS "${PLANNING_RUN_STAGE}"`);
  await knex.raw(`DROP TYPE IF EXISTS "${PLANNING_RUN_STATE}"`);
}

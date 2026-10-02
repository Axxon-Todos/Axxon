// Adds typed agent runs, planning snapshots, and durable tool-call history for the unified agent system.
import type { Knex } from 'knex';

const AGENT_RUN_TYPE = 'agent_run_type';

async function createEnumTypeIfMissing(knex: Knex, enumName: string, values: string[]) {
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
  await createEnumTypeIfMissing(knex, AGENT_RUN_TYPE, [
    'planning',
    'coding',
    'planning_execution',
  ]);

  const hasRunType = await knex.schema.hasColumn('agent_runs', 'run_type');
  if (!hasRunType) {
    await knex.schema.alterTable('agent_runs', (table) => {
      table
        .specificType('run_type', `"${AGENT_RUN_TYPE}"`)
        .notNullable()
        .defaultTo('planning');
    });
  }

  const hasPlanningContext = await knex.schema.hasColumn('agent_runs', 'planning_context_json');
  if (!hasPlanningContext) {
    await knex.schema.alterTable('agent_runs', (table) => {
      table.jsonb('planning_context_json').notNullable().defaultTo('{}');
      table.jsonb('readiness_json').notNullable().defaultTo('{}');
      table.integer('clarification_turn_count').notNullable().defaultTo(0);
    });
  }

  const hasToolCalls = await knex.schema.hasTable('agent_tool_calls');
  if (!hasToolCalls) {
    await knex.schema.createTable('agent_tool_calls', (table) => {
      table.increments('id').primary();
      table
        .integer('run_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('agent_runs')
        .onDelete('CASCADE');
      table.string('tool_name').notNullable();
      table.string('status').notNullable();
      table.string('reason_code').notNullable();
      table.jsonb('input_json').notNullable();
      table.jsonb('result_json').nullable();
      table.text('error_message').nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('completed_at').nullable();

      table.index(['run_id', 'created_at']);
      table.index(['tool_name', 'status']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('agent_tool_calls');
  await knex.schema.alterTable('agent_runs', (table) => {
    table.dropColumn('clarification_turn_count');
    table.dropColumn('readiness_json');
    table.dropColumn('planning_context_json');
    table.dropColumn('run_type');
  });
  await knex.raw(`DROP TYPE IF EXISTS "${AGENT_RUN_TYPE}"`);
}

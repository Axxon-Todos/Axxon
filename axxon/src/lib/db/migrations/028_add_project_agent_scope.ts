// Adds project context and architecture intent to the shared durable agent-run runtime.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('agent_runs'))) return;

  await knex.schema.alterTable('agent_runs', (table) => {
    table.integer('project_id').unsigned().nullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('architecture_intent').nullable();
    table.jsonb('target_context_json').nullable();
  });

  await knex.schema.alterTable('agent_runs', (table) => {
    table.integer('board_id').unsigned().nullable().alter();
  });

  await knex.raw(`ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_scope_check CHECK ((board_id IS NOT NULL AND project_id IS NULL) OR (board_id IS NULL AND project_id IS NOT NULL))`);
  await knex.schema.alterTable('agent_runs', (table) => {
    table.index(['organization_id', 'project_id', 'updated_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('agent_runs'))) return;
  await knex.raw('ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_scope_check');
  await knex.schema.alterTable('agent_runs', (table) => {
    table.dropIndex(['organization_id', 'project_id', 'updated_at']);
    table.dropColumn('target_context_json');
    table.dropColumn('architecture_intent');
    table.dropColumn('project_id');
    table.integer('board_id').unsigned().notNullable().alter();
  });
}

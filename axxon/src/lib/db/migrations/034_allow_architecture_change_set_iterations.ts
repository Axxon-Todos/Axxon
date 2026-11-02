// Allows one durable architecture run to preserve every requested-change proposal iteration.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('architecture_change_sets', (table) => {
    table.dropUnique(['run_id']);
    table.index(['run_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('architecture_change_sets', (table) => {
    table.dropIndex(['run_id', 'created_at']);
    table.unique(['run_id']);
  });
}

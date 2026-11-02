// Adds persisted width and height values so architecture nodes remain resizable across sessions.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('architecture_view_nodes', (table) => {
    table.float('width').nullable();
    table.float('height').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('architecture_view_nodes', (table) => {
    table.dropColumn('width');
    table.dropColumn('height');
  });
}

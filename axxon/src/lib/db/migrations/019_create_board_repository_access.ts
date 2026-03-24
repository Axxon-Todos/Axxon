import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('board_repository_access', (table) => {
    table
      .integer('board_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('boards')
      .onDelete('CASCADE');
    table
      .integer('repository_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('repositories')
      .onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.primary(['board_id', 'repository_id']);
    table.index(['repository_id', 'board_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('board_repository_access');
}

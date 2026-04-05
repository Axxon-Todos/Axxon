import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sprints', (table) => {
    table.increments('id').primary();
    table
      .integer('board_id')
      .notNullable()
      .references('id')
      .inTable('boards')
      .onDelete('CASCADE');
    table.string('name').notNullable().index();
    table.text('description');
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.string('color');
    table.string('icon');
    table.timestamp('archived_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.raw(`
    ALTER TABLE sprints
    ADD CONSTRAINT sprints_valid_date_range
    CHECK (end_date >= start_date)
  `);

  await knex.schema.alterTable('todos', (table) => {
    table
      .integer('sprint_id')
      .references('id')
      .inTable('sprints')
      .onDelete('SET NULL');
    table.index(['board_id', 'sprint_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('todos', (table) => {
    table.dropIndex(['board_id', 'sprint_id']);
    table.dropColumn('sprint_id');
  });

  await knex.schema.dropTableIfExists('sprints');
}

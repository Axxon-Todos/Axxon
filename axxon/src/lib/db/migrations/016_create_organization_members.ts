import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('organization_members', (table) => {
    table
      .integer('organization_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .enu('role', ['owner', 'member'], {
        useNative: true,
        enumName: 'organization_member_role',
      })
      .notNullable()
      .defaultTo('member');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.primary(['organization_id', 'user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('organization_members');
  await knex.raw('DROP TYPE IF EXISTS organization_member_role');
}

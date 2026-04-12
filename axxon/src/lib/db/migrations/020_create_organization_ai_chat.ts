// Creates org-scoped AI chat thread and message persistence for the organization AI workspace.
import type { Knex } from 'knex';

const ORGANIZATION_AI_CHAT_MESSAGE_ROLE = 'organization_ai_chat_message_role';
const ORGANIZATION_AI_CHAT_MESSAGE_STATUS =
  'organization_ai_chat_message_status';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chat_threads', (table) => {
    table.increments('id').primary();
    table
      .integer('organization_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .integer('created_by')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('title').notNullable();
    table.text('summary').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['organization_id', 'created_by', 'updated_at']);
  });

  await knex.schema.createTable('chat_messages', (table) => {
    table.increments('id').primary();
    table
      .integer('thread_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('chat_threads')
      .onDelete('CASCADE');
    table
      .enu('role', ['user', 'assistant'], {
        useNative: true,
        enumName: ORGANIZATION_AI_CHAT_MESSAGE_ROLE,
      })
      .notNullable();
    table.text('content').notNullable();
    table.integer('sequence_number').notNullable();
    table
      .enu('status', ['completed', 'failed'], {
        useNative: true,
        enumName: ORGANIZATION_AI_CHAT_MESSAGE_STATUS,
      })
      .notNullable()
      .defaultTo('completed');
    table.string('model').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['thread_id', 'sequence_number']);
    table.index(['thread_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_threads');
  await knex.raw(`DROP TYPE IF EXISTS ${ORGANIZATION_AI_CHAT_MESSAGE_STATUS}`);
  await knex.raw(`DROP TYPE IF EXISTS ${ORGANIZATION_AI_CHAT_MESSAGE_ROLE}`);
}

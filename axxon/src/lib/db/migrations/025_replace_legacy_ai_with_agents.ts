// Replaces the development-only AI chat and planning schema with the unified agent-run schema.
import type { Knex } from 'knex';

const legacyEnums = [
  'planning_executor_kind',
  'planning_run_stage',
  'planning_run_state',
  'planning_question_status',
  'planning_question_category',
  'planning_session_message_status',
  'planning_session_message_kind',
  'planning_session_message_role',
  'planning_session_state',
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('planning_runs');
  await knex.schema.dropTableIfExists('planning_session_questions');
  await knex.schema.dropTableIfExists('planning_session_messages');
  await knex.schema.dropTableIfExists('planning_sessions');
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_threads');

  for (const enumName of legacyEnums) {
    await knex.raw(`DROP TYPE IF EXISTS "${enumName}"`);
  }

  await knex.schema.createTable('agent_runs', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.integer('board_id').unsigned().notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('title').notNullable();
    table.text('prompt').notNullable();
    table.string('state').notNullable().defaultTo('queued');
    table.integer('version').notNullable().defaultTo(1);
    table.jsonb('questions_json').notNullable().defaultTo('[]');
    table.jsonb('plan_artifact_json').nullable();
    table.text('failure_message').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['organization_id', 'board_id', 'updated_at']);
  });

  await knex.schema.createTable('agent_run_events', (table) => {
    table.increments('id').primary();
    table.integer('run_id').unsigned().notNullable().references('id').inTable('agent_runs').onDelete('CASCADE');
    table.string('event_type').notNullable();
    table.string('from_state').nullable();
    table.string('to_state').notNullable();
    table.string('actor_type').notNullable();
    table.integer('actor_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.jsonb('payload_json').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['run_id', 'created_at']);
  });

  await knex.schema.createTable('agent_run_messages', (table) => {
    table.increments('id').primary();
    table.integer('run_id').unsigned().notNullable().references('id').inTable('agent_runs').onDelete('CASCADE');
    table.string('role').notNullable();
    table.text('content').notNullable();
    table.jsonb('metadata_json').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['run_id', 'created_at']);
  });

  await knex.schema.createTable('agent_jobs', (table) => {
    table.increments('id').primary();
    table.integer('run_id').unsigned().notNullable().references('id').inTable('agent_runs').onDelete('CASCADE');
    table.string('kind').notNullable();
    table.string('state').notNullable().defaultTo('queued');
    table.integer('attempt_count').notNullable().defaultTo(0);
    table.timestamp('available_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('locked_at').nullable();
    table.string('locked_by').nullable();
    table.text('error_message').nullable();
    table.timestamp('finished_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['state', 'available_at']);
  });

  await knex.schema.createTable('agent_outbox_events', (table) => {
    table.increments('id').primary();
    table.integer('run_id').unsigned().notNullable().references('id').inTable('agent_runs').onDelete('CASCADE');
    table.string('type').notNullable();
    table.jsonb('payload_json').notNullable();
    table.string('state').notNullable().defaultTo('pending');
    table.integer('attempt_count').notNullable().defaultTo(0);
    table.timestamp('published_at').nullable();
    table.text('error_message').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['state', 'created_at']);
  });

  await knex.schema.createTable('agent_conversations', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('title').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('agent_conversation_messages', (table) => {
    table.increments('id').primary();
    table.integer('conversation_id').unsigned().notNullable().references('id').inTable('agent_conversations').onDelete('CASCADE');
    table.string('role').notNullable();
    table.text('content').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['conversation_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('agent_conversation_messages');
  await knex.schema.dropTableIfExists('agent_conversations');
  await knex.schema.dropTableIfExists('agent_outbox_events');
  await knex.schema.dropTableIfExists('agent_jobs');
  await knex.schema.dropTableIfExists('agent_run_messages');
  await knex.schema.dropTableIfExists('agent_run_events');
  await knex.schema.dropTableIfExists('agent_runs');
}

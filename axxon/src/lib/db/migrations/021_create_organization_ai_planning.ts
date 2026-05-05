// Creates board-bound AI planning session persistence alongside the existing org AI chat tables.
import type { Knex } from 'knex';

const PLANNING_SESSION_STATE = 'planning_session_state';
const PLANNING_SESSION_MESSAGE_ROLE = 'planning_session_message_role';
const PLANNING_SESSION_MESSAGE_KIND = 'planning_session_message_kind';
const PLANNING_SESSION_MESSAGE_STATUS = 'planning_session_message_status';
const PLANNING_QUESTION_CATEGORY = 'planning_question_category';
const PLANNING_QUESTION_STATUS = 'planning_question_status';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('planning_sessions', (table) => {
    table.increments('id').primary();
    table
      .integer('organization_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .integer('board_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('boards')
      .onDelete('CASCADE');
    table
      .integer('created_by')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('title').notNullable();
    table.text('summary').notNullable().defaultTo('');
    table.text('original_prompt').notNullable();
    table
      .enu(
        'planner_state',
        ['analyzing', 'clarifying', 'planning', 'plan_generated', 'failed'],
        {
          useNative: true,
          enumName: PLANNING_SESSION_STATE,
        }
      )
      .notNullable()
      .defaultTo('analyzing');
    table.jsonb('context_json').notNullable();
    table.jsonb('readiness_json').notNullable();
    table.integer('clarification_turn_count').notNullable().defaultTo(0);
    table.jsonb('plan_artifact_json').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['organization_id', 'board_id', 'created_by', 'updated_at']);
  });

  await knex.schema.createTable('planning_session_messages', (table) => {
    table.increments('id').primary();
    table
      .integer('session_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('planning_sessions')
      .onDelete('CASCADE');
    table
      .enu('role', ['user', 'assistant'], {
        useNative: true,
        enumName: PLANNING_SESSION_MESSAGE_ROLE,
      })
      .notNullable();
    table
      .enu(
        'message_kind',
        ['user_input', 'clarification_questions', 'planner_status', 'plan_summary'],
        {
          useNative: true,
          enumName: PLANNING_SESSION_MESSAGE_KIND,
        }
      )
      .notNullable();
    table.text('content').notNullable();
    table.integer('sequence_number').notNullable();
    table
      .enu('status', ['pending', 'processing', 'completed', 'failed'], {
        useNative: true,
        enumName: PLANNING_SESSION_MESSAGE_STATUS,
      })
      .notNullable()
      .defaultTo('pending');
    table.jsonb('metadata_json').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['session_id', 'sequence_number']);
    table.index(['session_id', 'created_at']);
  });

  await knex.schema.createTable('planning_session_questions', (table) => {
    table.increments('id').primary();
    table
      .integer('session_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('planning_sessions')
      .onDelete('CASCADE');
    table.string('question_key').notNullable();
    table
      .enu(
        'category',
        ['scope', 'technical', 'constraints', 'dependencies', 'acceptance_criteria', 'priority', 'ux', 'rollout'],
        {
          useNative: true,
          enumName: PLANNING_QUESTION_CATEGORY,
        }
      )
      .notNullable();
    table.text('question_text').notNullable();
    table.text('why_this_matters').notNullable();
    table.boolean('is_required').notNullable().defaultTo(false);
    table.boolean('is_blocking').notNullable().defaultTo(false);
    table
      .enu('status', ['open', 'answered', 'superseded'], {
        useNative: true,
        enumName: PLANNING_QUESTION_STATUS,
      })
      .notNullable()
      .defaultTo('open');
    table
      .integer('asked_in_message_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('planning_session_messages')
      .onDelete('SET NULL');
    table
      .integer('answered_in_message_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('planning_session_messages')
      .onDelete('SET NULL');
    table.timestamp('asked_at').nullable();
    table.timestamp('answered_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['session_id', 'question_key']);
    table.index(['session_id', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('planning_session_questions');
  await knex.schema.dropTableIfExists('planning_session_messages');
  await knex.schema.dropTableIfExists('planning_sessions');
  await knex.raw(`DROP TYPE IF EXISTS ${PLANNING_QUESTION_STATUS}`);
  await knex.raw(`DROP TYPE IF EXISTS ${PLANNING_QUESTION_CATEGORY}`);
  await knex.raw(`DROP TYPE IF EXISTS ${PLANNING_SESSION_MESSAGE_STATUS}`);
  await knex.raw(`DROP TYPE IF EXISTS ${PLANNING_SESSION_MESSAGE_KIND}`);
  await knex.raw(`DROP TYPE IF EXISTS ${PLANNING_SESSION_MESSAGE_ROLE}`);
  await knex.raw(`DROP TYPE IF EXISTS ${PLANNING_SESSION_STATE}`);
}

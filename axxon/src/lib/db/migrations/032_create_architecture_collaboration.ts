// Creates durable project collaboration threads, comments, and replayable realtime events.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('architecture_comment_threads', (table) => {
    table.increments('id').primary();
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('component_id', 36).nullable().references('id').inTable('architecture_components').onDelete('SET NULL');
    table.string('relationship_id', 36).nullable().references('id').inTable('architecture_relationships').onDelete('SET NULL');
    table.integer('revision_id').unsigned().nullable().references('id').inTable('architecture_revisions').onDelete('SET NULL');
    table.integer('proposal_run_id').unsigned().nullable().references('id').inTable('agent_runs').onDelete('SET NULL');
    table.string('status').notNullable().defaultTo('open');
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.integer('resolved_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('resolved_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['project_id', 'status', 'updated_at']);
    table.check('((component_id IS NOT NULL) OR (relationship_id IS NOT NULL))');
    table.check("status IN ('open', 'resolved')");
  });

  await knex.schema.createTable('architecture_comments', (table) => {
    table.increments('id').primary();
    table.integer('thread_id').unsigned().notNullable().references('id').inTable('architecture_comment_threads').onDelete('CASCADE');
    table.integer('author_id').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('author_type').notNullable().defaultTo('human');
    table.text('body').notNullable();
    table.jsonb('mentions').notNullable().defaultTo('[]');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['thread_id', 'created_at']);
  });

  await knex.schema.createTable('architecture_collaboration_events', (table) => {
    table.bigIncrements('id').primary();
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.integer('actor_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('event_type').notNullable();
    table.jsonb('payload').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['project_id', 'id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  throw new Error('Migration 032 is irreversible: it owns durable architecture collaboration history. Restore from a database backup instead.');
}

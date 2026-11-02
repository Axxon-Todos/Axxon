// Creates first-class project requirements and immutable architecture change-set records.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('architecture_requirements', (table) => {
    table.increments('id').primary();
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('key').notNullable();
    table.string('title').notNullable();
    table.text('statement').notNullable();
    table.string('category').notNullable();
    table.string('priority').notNullable();
    table.string('status').notNullable();
    table.string('source').notNullable();
    table.text('rationale').nullable();
    table.jsonb('answer_json').notNullable().defaultTo('{}');
    table.boolean('blocking').notNullable().defaultTo(false);
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['project_id', 'key']);
    table.index(['project_id', 'status']);
  });
  await knex.schema.createTable('architecture_requirement_links', (table) => {
    table.integer('requirement_id').unsigned().notNullable().references('id').inTable('architecture_requirements').onDelete('CASCADE');
    table.string('entity_type').notNullable();
    table.string('entity_id').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.primary(['requirement_id', 'entity_type', 'entity_id']);
  });
  await knex.schema.createTable('architecture_change_sets', (table) => {
    table.increments('id').primary();
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.integer('run_id').unsigned().notNullable().references('id').inTable('agent_runs').onDelete('CASCADE');
    table.integer('base_revision_id').unsigned().notNullable().references('id').inTable('architecture_revisions').onDelete('RESTRICT');
    table.string('base_content_hash', 128).notNullable();
    table.jsonb('operations_json').notNullable();
    table.jsonb('proposed_graph_json').notNullable();
    table.jsonb('semantic_diff_json').notNullable();
    table.jsonb('impact_findings_json').notNullable().defaultTo('[]');
    table.jsonb('validation_json').notNullable().defaultTo('{}');
    table.jsonb('assumptions_json').notNullable().defaultTo('[]');
    table.jsonb('risks_json').notNullable().defaultTo('[]');
    table.jsonb('provenance_json').notNullable().defaultTo('{}');
    table.string('status').notNullable().defaultTo('pending_review');
    table.integer('reviewed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.text('review_feedback').nullable();
    table.timestamp('reviewed_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['project_id', 'created_at']);
    table.unique(['run_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('architecture_change_sets');
  await knex.schema.dropTableIfExists('architecture_requirement_links');
  await knex.schema.dropTableIfExists('architecture_requirements');
}

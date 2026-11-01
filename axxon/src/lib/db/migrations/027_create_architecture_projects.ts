// Creates the project and canonical architecture draft/revision tables for Axxon V2.
import type { Knex } from 'knex';

const componentTypes = [
  'application',
  'service',
  'module',
  'api',
  'database',
  'cache',
  'queue',
  'external_service',
  'cloud_resource',
  'security_control',
  'monitoring',
];

const relationshipTypes = [
  'depends_on',
  'calls',
  'reads_from',
  'writes_to',
  'publishes_to',
  'subscribes_to',
  'authenticates_through',
  'deployed_on',
  'monitored_by',
  'secured_by',
];

const viewKeys = ['overview', 'backend', 'api_auth', 'data', 'infrastructure'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('projects', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description').nullable();
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['organization_id', 'created_at']);
  });

  await knex.schema.createTable('architecture_revisions', (table) => {
    table.increments('id').primary();
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.integer('version').unsigned().notNullable();
    table.integer('parent_revision_id').unsigned().nullable().references('id').inTable('architecture_revisions').onDelete('SET NULL');
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.jsonb('snapshot_json').notNullable();
    table.text('summary').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['project_id', 'version']);
    table.index(['project_id', 'created_at']);
  });

  await knex.schema.createTable('architecture_drafts', (table) => {
    table.integer('project_id').unsigned().primary().references('id').inTable('projects').onDelete('CASCADE');
    table.integer('base_revision_id').unsigned().notNullable().references('id').inTable('architecture_revisions').onDelete('RESTRICT');
    table.integer('updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('architecture_components', (table) => {
    table.string('id', 36).primary();
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('type').notNullable();
    table.string('name').notNullable();
    table.text('description').nullable();
    table.string('parent_id', 36).nullable().references('id').inTable('architecture_components').onDelete('SET NULL');
    table.jsonb('responsibilities').notNullable().defaultTo('[]');
    table.jsonb('technologies').notNullable().defaultTo('[]');
    table.jsonb('requirements').notNullable().defaultTo('[]');
    table.jsonb('constraints').notNullable().defaultTo('[]');
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['project_id', 'type']);
  });

  await knex.schema.createTable('architecture_relationships', (table) => {
    table.string('id', 36).primary();
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('source_component_id', 36).notNullable().references('id').inTable('architecture_components').onDelete('CASCADE');
    table.string('target_component_id', 36).notNullable().references('id').inTable('architecture_components').onDelete('CASCADE');
    table.string('type').notNullable();
    table.string('label').nullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['project_id', 'source_component_id']);
    table.index(['project_id', 'target_component_id']);
  });

  await knex.schema.createTable('architecture_views', (table) => {
    table.increments('id').primary();
    table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('key').notNullable();
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.jsonb('filter_json').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['project_id', 'key']);
  });

  await knex.schema.createTable('architecture_view_nodes', (table) => {
    table.integer('view_id').unsigned().notNullable().references('id').inTable('architecture_views').onDelete('CASCADE');
    table.string('component_id', 36).notNullable().references('id').inTable('architecture_components').onDelete('CASCADE');
    table.float('position_x').notNullable().defaultTo(0);
    table.float('position_y').notNullable().defaultTo(0);
    table.boolean('hidden').notNullable().defaultTo(false);
    table.primary(['view_id', 'component_id']);
  });

  // Keep the initial vocabulary enforced at the persistence boundary.
  await knex.raw(`ALTER TABLE architecture_components ADD CONSTRAINT architecture_components_type_check CHECK (type IN (${componentTypes.map((value) => `'${value}'`).join(', ')}))`);
  await knex.raw(`ALTER TABLE architecture_relationships ADD CONSTRAINT architecture_relationships_type_check CHECK (type IN (${relationshipTypes.map((value) => `'${value}'`).join(', ')}))`);
  await knex.raw(`ALTER TABLE architecture_views ADD CONSTRAINT architecture_views_key_check CHECK (key IN (${viewKeys.map((value) => `'${value}'`).join(', ')}))`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('architecture_view_nodes');
  await knex.schema.dropTableIfExists('architecture_views');
  await knex.schema.dropTableIfExists('architecture_relationships');
  await knex.schema.dropTableIfExists('architecture_components');
  await knex.schema.dropTableIfExists('architecture_drafts');
  await knex.schema.dropTableIfExists('architecture_revisions');
  await knex.schema.dropTableIfExists('projects');
}

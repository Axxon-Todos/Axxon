// Creates the database foundation for org-scoped GitHub installations, repositories, and webhook events.
import type { Knex } from 'knex';

const GITHUB_INSTALLATION_STATUS = 'github_installation_status';
const GITHUB_REPOSITORY_SELECTION = 'github_repository_selection';
const GITHUB_WEBHOOK_EVENT_STATUS = 'github_webhook_event_status';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('github_installations', (table) => {
    table.increments('id').primary();
    table
      .integer('organization_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.bigInteger('github_installation_id').notNullable().unique();
    table.bigInteger('github_account_id').notNullable();
    table.string('github_account_login').notNullable();
    table.string('github_account_type').notNullable();
    table
      .enu('repository_selection', ['all', 'selected'], {
        useNative: true,
        enumName: GITHUB_REPOSITORY_SELECTION,
      })
      .notNullable();
    table
      .enu('status', ['pending', 'active', 'suspended', 'removed'], {
        useNative: true,
        enumName: GITHUB_INSTALLATION_STATUS,
      })
      .notNullable()
      .defaultTo('pending');
    table
      .integer('installed_by_user_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('last_synced_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['organization_id', 'status']);
    table.index(['github_account_login']);
  });

  await knex.schema.createTable('repositories', (table) => {
    table.increments('id').primary();
    table
      .integer('organization_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.bigInteger('github_installation_id').notNullable();
    table.bigInteger('github_repo_id').notNullable().unique();
    table.string('name').notNullable();
    table.string('full_name').notNullable();
    table.string('owner_login').notNullable();
    table.string('default_branch').nullable();
    table.boolean('private').notNullable();
    table.boolean('archived').notNullable().defaultTo(false);
    table.string('html_url').notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.jsonb('raw_json').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table
      .foreign('github_installation_id')
      .references('github_installation_id')
      .inTable('github_installations')
      .onDelete('CASCADE');

    table.index(['organization_id', 'is_active']);
    table.index(['github_installation_id', 'is_active']);
    table.index(['organization_id', 'full_name']);
  });

  await knex.schema.createTable('github_webhook_events', (table) => {
    table.increments('id').primary();
    table.string('github_delivery_id').notNullable().unique();
    table.string('event_name').notNullable();
    table.string('action').nullable();
    table.bigInteger('github_installation_id').nullable();
    table.bigInteger('github_repository_id').nullable();
    table.string('signature_256').nullable();
    table.jsonb('payload_json').notNullable();
    table.jsonb('headers_json').notNullable();
    table.timestamp('received_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('processed_at').nullable();
    table
      .enu('status', ['received', 'processed', 'ignored', 'failed'], {
        useNative: true,
        enumName: GITHUB_WEBHOOK_EVENT_STATUS,
      })
      .notNullable()
      .defaultTo('received');
    table.text('error_message').nullable();
    table.integer('retry_count').notNullable().defaultTo(0);

    table.index(['event_name']);
    table.index(['github_installation_id']);
    table.index(['received_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('github_webhook_events');
  await knex.schema.dropTableIfExists('repositories');
  await knex.schema.dropTableIfExists('github_installations');
  await knex.raw(`DROP TYPE IF EXISTS ${GITHUB_WEBHOOK_EVENT_STATUS}`);
  await knex.raw(`DROP TYPE IF EXISTS ${GITHUB_REPOSITORY_SELECTION}`);
  await knex.raw(`DROP TYPE IF EXISTS ${GITHUB_INSTALLATION_STATUS}`);
}

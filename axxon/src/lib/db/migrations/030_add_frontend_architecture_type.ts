// Adds an explicit frontend component type for user-facing architecture nodes.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE architecture_components DROP CONSTRAINT IF EXISTS architecture_components_type_check");
  await knex.raw("ALTER TABLE architecture_components ADD CONSTRAINT architecture_components_type_check CHECK (type IN ('application', 'frontend', 'service', 'module', 'api', 'database', 'cache', 'queue', 'external_service', 'cloud_resource', 'security_control', 'monitoring'))");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("UPDATE architecture_components SET type = 'application' WHERE type = 'frontend'");
  await knex.raw("ALTER TABLE architecture_components DROP CONSTRAINT IF EXISTS architecture_components_type_check");
  await knex.raw("ALTER TABLE architecture_components ADD CONSTRAINT architecture_components_type_check CHECK (type IN ('application', 'service', 'module', 'api', 'database', 'cache', 'queue', 'external_service', 'cloud_resource', 'security_control', 'monitoring'))");
}

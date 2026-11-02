// Expands architecture vocabulary and focused views without changing existing project graph identity.
import type { Knex } from 'knex';

const componentTypes = ['application', 'frontend', 'service', 'backend_domain', 'module', 'api', 'gateway', 'database', 'storage', 'cache', 'queue', 'event_bus', 'external_service', 'integration', 'cloud_resource', 'network_boundary', 'deployment_environment', 'security_control', 'trust_boundary', 'monitoring', 'observability'];
const viewKeys = ['overview', 'frontend', 'backend', 'api_auth', 'data', 'infrastructure', 'security', 'observability'];
const viewDefinitions = [
  ['frontend', 'Frontend', 'Client applications, UI modules, and delivery paths.'],
  ['security', 'Security', 'Trust boundaries, controls, identity, and protected dependencies.'],
  ['observability', 'DevOps and Observability', 'Monitoring, delivery, logging, metrics, and operational dependencies.'],
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE architecture_components DROP CONSTRAINT IF EXISTS architecture_components_type_check');
  await knex.raw(`ALTER TABLE architecture_components ADD CONSTRAINT architecture_components_type_check CHECK (type IN (${componentTypes.map((value) => `'${value}'`).join(', ')}))`);
  await knex.raw('ALTER TABLE architecture_views DROP CONSTRAINT IF EXISTS architecture_views_key_check');
  await knex.raw(`ALTER TABLE architecture_views ADD CONSTRAINT architecture_views_key_check CHECK (key IN (${viewKeys.map((value) => `'${value}'`).join(', ')}))`);
  const projects = await knex('projects').select('id');
  for (const project of projects) {
    for (const [key, name, description] of viewDefinitions) {
      await knex('architecture_views').insert({ project_id: project.id, key, name, description, filter_json: {} }).onConflict(['project_id', 'key']).ignore();
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  throw new Error('Migration 031 is irreversible: it adds architecture vocabulary and seeded views that may contain user data. Restore from a database backup instead.');
}

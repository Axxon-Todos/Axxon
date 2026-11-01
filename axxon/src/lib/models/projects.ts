// Persists organization-owned architecture projects and initializes their empty canonical graph.
import knex from '@/lib/db/db';
import type { ProjectBaseData, ProjectCreation } from '@/lib/types/projectTypes';
import { architectureViewKeys, type ArchitectureGraph } from '@/lib/types/architectureTypes';

const viewDefinitions = [
  ['overview', 'System Overview', 'Major applications, services, data stores, and deployment boundaries.'],
  ['backend', 'Backend', 'Server-side services, modules, queues, caches, and data access.'],
  ['api_auth', 'API and Authentication', 'Public and internal APIs, identity, sessions, and authorization.'],
  ['data', 'Data and Persistence', 'Databases, caches, storage, ownership, and data movement.'],
  ['infrastructure', 'Infrastructure and Deployment', 'Runtime resources, environments, ingress, and network boundaries.'],
] as const;

export class Projects {
  static async create(data: ProjectCreation): Promise<ProjectBaseData> {
    return knex.transaction(async (trx) => {
      const [project] = await trx('projects').insert({ ...data, created_at: trx.fn.now(), updated_at: trx.fn.now() }).returning('*');
      const emptyGraph: ArchitectureGraph = { components: [], relationships: [], views: [] };
      const [revision] = await trx('architecture_revisions').insert({ project_id: project.id, version: 1, snapshot_json: emptyGraph, created_by: data.created_by, summary: 'Initial empty architecture.' }).returning('*');
      await trx('architecture_drafts').insert({ project_id: project.id, base_revision_id: revision.id, updated_by: data.created_by });
      const views = viewDefinitions.map(([key, name, description]) => ({ project_id: project.id, key, name, description, filter_json: {} }));
      await trx('architecture_views').insert(views);
      return project;
    });
  }

  static async listForOrganization(organizationId: number) {
    return knex('projects').where({ organization_id: organizationId }).orderBy('updated_at', 'desc') as unknown as Promise<ProjectBaseData[]>;
  }

  static async getById(projectId: number) {
    return (await knex('projects').where({ id: projectId }).first()) as ProjectBaseData | undefined;
  }

  static async getByIdInOrganization(projectId: number, organizationId: number) {
    return (await knex('projects').where({ id: projectId, organization_id: organizationId }).first()) as ProjectBaseData | undefined;
  }

  static async getViewDefinitions(projectId: number) {
    return knex('architecture_views').where({ project_id: projectId }).orderByRaw(`array_position(ARRAY[${architectureViewKeys.map((key) => `'${key}'`).join(',')}], key)`);
  }
}

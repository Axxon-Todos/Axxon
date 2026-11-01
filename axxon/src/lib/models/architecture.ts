// Persists and validates the normalized architecture draft and immutable revision snapshots.
import knex from '@/lib/db/db';
import type { Knex } from 'knex';
import type { ArchitectureDraftInput, ArchitectureGraph, ArchitectureRevision } from '@/lib/types/architectureTypes';
import { validateArchitectureDraft } from '@/lib/utils/architectureValidation';

export class Architecture {
  static async getGraph(projectId: number): Promise<ArchitectureGraph> {
    const [components, relationships, views] = await Promise.all([
      knex('architecture_components').where({ project_id: projectId }).orderBy('created_at', 'asc'),
      knex('architecture_relationships').where({ project_id: projectId }).orderBy('created_at', 'asc'),
      knex('architecture_views').where({ project_id: projectId }).orderBy('id', 'asc'),
    ]);
    const viewIds = views.map((view) => view.id);
    const nodes = viewIds.length ? await knex('architecture_view_nodes').whereIn('view_id', viewIds) : [];
    return {
      components,
      relationships,
      views: views.map((view) => ({ ...view, nodes: nodes.filter((node) => node.view_id === view.id).map(({ view_id: _viewId, ...node }) => node) })),
    } as ArchitectureGraph;
  }

  static async replaceDraft(projectId: number, userId: number, input: ArchitectureDraftInput) {
    validateArchitectureDraft(input);
    return knex.transaction(async (trx) => {
      const draft = await trx('architecture_drafts').where({ project_id: projectId }).first();
      if (!draft || draft.base_revision_id !== input.base_revision_id) throw new Error('Architecture draft is based on an outdated revision');
      await trx('architecture_view_nodes').whereIn('view_id', trx('architecture_views').select('id').where({ project_id: projectId })).del();
      await trx('architecture_relationships').where({ project_id: projectId }).del();
      await trx('architecture_components').where({ project_id: projectId }).del();
      if (input.components.length) await trx('architecture_components').insert(input.components.map((component) => ({ ...component, project_id: projectId, created_at: trx.fn.now(), updated_at: trx.fn.now() })));
      if (input.relationships.length) await trx('architecture_relationships').insert(input.relationships.map((relationship) => ({ ...relationship, project_id: projectId, created_at: trx.fn.now(), updated_at: trx.fn.now() })));
      const viewRows = await trx('architecture_views').where({ project_id: projectId }).select('id', 'key');
      for (const view of input.views) {
        const row = viewRows.find((candidate) => candidate.key === view.key);
        if (!row || !view.nodes.length) continue;
        await trx('architecture_view_nodes').insert(view.nodes.map((node) => ({ ...node, view_id: row.id })));
      }
      await trx('architecture_drafts').where({ project_id: projectId }).update({ updated_by: userId, updated_at: trx.fn.now() });
      return this.getGraphWithTransaction(projectId, trx);
    });
  }

  static async commitRevision(projectId: number, userId: number, summary: string | null) {
    return knex.transaction(async (trx) => {
      const draft = await trx('architecture_drafts').where({ project_id: projectId }).forUpdate().first();
      if (!draft) throw new Error('Architecture draft not found');
      const current = await trx('architecture_revisions').where({ id: draft.base_revision_id }).first();
      if (!current) throw new Error('Architecture base revision not found');
      const graph = await this.getGraphWithTransaction(projectId, trx);
      const [revision] = await trx('architecture_revisions').insert({ project_id: projectId, version: current.version + 1, parent_revision_id: current.id, created_by: userId, snapshot_json: graph, summary }).returning('*');
      await trx('architecture_drafts').where({ project_id: projectId }).update({ base_revision_id: revision.id, updated_by: userId, updated_at: trx.fn.now() });
      return revision as ArchitectureRevision;
    });
  }

  static async listRevisions(projectId: number) {
    return knex('architecture_revisions').where({ project_id: projectId }).orderBy('version', 'desc') as unknown as Promise<ArchitectureRevision[]>;
  }

  private static async getGraphWithTransaction(projectId: number, trx: Knex.Transaction): Promise<ArchitectureGraph> {
    const [components, relationships, views] = await Promise.all([
      trx('architecture_components').where({ project_id: projectId }).orderBy('created_at', 'asc'),
      trx('architecture_relationships').where({ project_id: projectId }).orderBy('created_at', 'asc'),
      trx('architecture_views').where({ project_id: projectId }).orderBy('id', 'asc'),
    ]);
    const nodes = views.length ? await trx('architecture_view_nodes').whereIn('view_id', views.map((view) => view.id)) : [];
    return { components, relationships, views: views.map((view) => ({ ...view, nodes: nodes.filter((node) => node.view_id === view.id).map(({ view_id: _viewId, ...node }) => node) })) } as ArchitectureGraph;
  }
}

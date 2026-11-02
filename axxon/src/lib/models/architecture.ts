// Persists and validates the normalized architecture draft and immutable revision snapshots.
import knex from '@/lib/db/db';
import type { Knex } from 'knex';
import type { ArchitectureDraftInput, ArchitectureGraph, ArchitectureRevision } from '@/lib/types/architectureTypes';
import { validateArchitectureDraft } from '@/lib/utils/architectureValidation';
import type { ArchitectureChangeProposal } from '@/lib/agents/architecture/contracts';
import { validateArchitectureProposal } from '@/lib/agents/architecture/operations';

// Serializes JSONB columns defensively so provider output can never reach Postgres in an invalid shape.
function jsonArray(value: unknown) {
  const parsed = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return []; } })() : value;
  return JSON.stringify(Array.isArray(parsed) ? parsed : []);
}

// Serializes JSONB object columns defensively with an empty-object fallback.
function jsonObject(value: unknown) {
  const parsed = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return {}; } })() : value;
  return JSON.stringify(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
}

// Builds a database-safe component row from either a draft or an approved proposal graph.
function componentRow(component: Record<string, unknown>, projectId: number, now: Knex.Transaction['fn']) {
  return { ...component, project_id: projectId, responsibilities: jsonArray(component.responsibilities), technologies: jsonArray(component.technologies), requirements: jsonArray(component.requirements), constraints: jsonArray(component.constraints), metadata: jsonObject(component.metadata), created_at: now.now(), updated_at: now.now() };
}

// Builds a database-safe relationship row from either a draft or an approved proposal graph.
function relationshipRow(relationship: Record<string, unknown>, projectId: number, now: Knex.Transaction['fn']) {
  return { ...relationship, project_id: projectId, metadata: jsonObject(relationship.metadata), created_at: now.now(), updated_at: now.now() };
}

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
      const draft = await trx('architecture_drafts').where({ project_id: projectId }).forUpdate().first();
      if (!draft || draft.base_revision_id !== input.base_revision_id) throw new Error('Architecture draft is based on an outdated revision');
      await trx('architecture_view_nodes').whereIn('view_id', trx('architecture_views').select('id').where({ project_id: projectId })).del();
      await trx('architecture_relationships').where({ project_id: projectId }).del();
      await trx('architecture_components').where({ project_id: projectId }).del();
      if (input.components.length) await trx('architecture_components').insert(input.components.map((component) => componentRow(component as unknown as Record<string, unknown>, projectId, trx.fn)));
      if (input.relationships.length) await trx('architecture_relationships').insert(input.relationships.map((relationship) => relationshipRow(relationship as unknown as Record<string, unknown>, projectId, trx.fn)));
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
      if (!current || Number(current.project_id) !== projectId) throw new Error('Architecture base revision not found for project');
      const graph = await this.getGraphWithTransaction(projectId, trx);
      const [revision] = await trx('architecture_revisions').insert({ project_id: projectId, version: current.version + 1, parent_revision_id: current.id, created_by: userId, snapshot_json: graph, summary }).returning('*');
      await trx('architecture_drafts').where({ project_id: projectId }).update({ base_revision_id: revision.id, updated_by: userId, updated_at: trx.fn.now() });
      return revision as ArchitectureRevision;
    });
  }

  // Atomically validates a review proposal against its exact base revision, replaces the draft, and creates a new revision.
  static async applyApprovedProposal(projectId: number, userId: number, proposal: ArchitectureChangeProposal, trx?: Knex.Transaction) {
    const apply = async (transaction: Knex.Transaction) => {
      const draft = await transaction('architecture_drafts').where({ project_id: projectId }).forUpdate().first();
      if (!draft || Number(draft.base_revision_id) !== proposal.baseRevisionId) throw new Error('Architecture proposal is based on an outdated revision');
      const current = await transaction('architecture_revisions').where({ id: draft.base_revision_id }).first();
      if (!current || Number(current.project_id) !== projectId) throw new Error('Architecture base revision not found for project');
      const graph = await this.getGraphWithTransaction(projectId, transaction);
      const nextGraph = validateArchitectureProposal(graph, proposal, projectId);
      await transaction('architecture_view_nodes').whereIn('view_id', transaction('architecture_views').select('id').where({ project_id: projectId })).del();
      await transaction('architecture_relationships').where({ project_id: projectId }).del();
      await transaction('architecture_components').where({ project_id: projectId }).del();
      if (nextGraph.components.length) await transaction('architecture_components').insert(nextGraph.components.map((component) => componentRow(component as unknown as Record<string, unknown>, projectId, transaction.fn)));
      if (nextGraph.relationships.length) await transaction('architecture_relationships').insert(nextGraph.relationships.map((relationship) => relationshipRow(relationship as unknown as Record<string, unknown>, projectId, transaction.fn)));
      const viewRows = await transaction('architecture_views').where({ project_id: projectId }).select('id', 'key');
      for (const view of nextGraph.views) {
        const row = viewRows.find((candidate) => candidate.key === view.key);
        if (row && view.nodes.length) await transaction('architecture_view_nodes').insert(view.nodes.map((node) => ({ ...node, view_id: row.id })));
      }
      const [revision] = await transaction('architecture_revisions').insert({ project_id: projectId, version: current.version + 1, parent_revision_id: current.id, created_by: userId, snapshot_json: nextGraph, summary: proposal.summary }).returning('*');
      await transaction('architecture_drafts').where({ project_id: projectId }).update({ base_revision_id: revision.id, updated_by: userId, updated_at: transaction.fn.now() });
      return revision as ArchitectureRevision;
    };
    return trx ? apply(trx) : knex.transaction(apply);
  }

  static async listRevisions(projectId: number) {
    return knex('architecture_revisions').where({ project_id: projectId }).orderBy('version', 'desc') as unknown as Promise<ArchitectureRevision[]>;
  }

  // Reads the canonical graph through the caller's transaction so validation and mutation share one snapshot.
  static async getGraphWithTransaction(projectId: number, trx: Knex.Transaction): Promise<ArchitectureGraph> {
    const [components, relationships, views] = await Promise.all([
      trx('architecture_components').where({ project_id: projectId }).orderBy('created_at', 'asc'),
      trx('architecture_relationships').where({ project_id: projectId }).orderBy('created_at', 'asc'),
      trx('architecture_views').where({ project_id: projectId }).orderBy('id', 'asc'),
    ]);
    const nodes = views.length ? await trx('architecture_view_nodes').whereIn('view_id', views.map((view) => view.id)) : [];
    return { components, relationships, views: views.map((view) => ({ ...view, nodes: nodes.filter((node) => node.view_id === view.id).map(({ view_id: _viewId, ...node }) => node) })) } as ArchitectureGraph;
  }
}

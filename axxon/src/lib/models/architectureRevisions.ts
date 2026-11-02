// Persists revision inspection and creates immutable revert revisions.
import knex from '@/lib/db/db';
import type { Knex } from 'knex';
import type { ArchitectureGraph, ArchitectureRevision } from '@/lib/types/architectureTypes';
import { diffArchitectureGraphs, type ArchitectureRevisionDiff } from '@/lib/utils/architectureRevisionDiff';

type RevisionRow = ArchitectureRevision & { snapshot_json: ArchitectureGraph | string };

function parseSnapshot(value: ArchitectureGraph | string): ArchitectureGraph {
  if (typeof value === 'string') return JSON.parse(value) as ArchitectureGraph;
  return value;
}

// Restores graph tables from a revision snapshot inside the caller's transaction.
async function restoreSnapshot(trx: Knex.Transaction, projectId: number, snapshot: ArchitectureGraph) {
  let viewRows = await trx('architecture_views').where({ project_id: projectId }).select('id', 'key');
  await trx('architecture_view_nodes').whereIn('view_id', viewRows.map((view) => view.id)).del();
  await trx('architecture_relationships').where({ project_id: projectId }).del();
  await trx('architecture_components').where({ project_id: projectId }).del();
  if (snapshot.components.length) {
    await trx('architecture_components').insert(snapshot.components.map((component) => ({ ...component, project_id: projectId })));
  }
  if (snapshot.relationships.length) {
    await trx('architecture_relationships').insert(snapshot.relationships.map((relationship) => ({ ...relationship, project_id: projectId })));
  }
  // Older initial revisions have no view snapshot; preserve the project's view catalog in that case.
  if (snapshot.views.length) {
    const snapshotKeys = snapshot.views.map((view) => view.key);
    await trx('architecture_views').where({ project_id: projectId }).whereNotIn('key', snapshotKeys).del();
    for (const view of snapshot.views) {
      await trx('architecture_views').where({ project_id: projectId, key: view.key }).update({ name: view.name, description: view.description, filter_json: view.filter_json, updated_at: trx.fn.now() });
      const existing = await trx('architecture_views').where({ project_id: projectId, key: view.key }).first();
      if (!existing) await trx('architecture_views').insert({ project_id: projectId, key: view.key, name: view.name, description: view.description, filter_json: view.filter_json });
    }
    viewRows = await trx('architecture_views').where({ project_id: projectId }).select('id', 'key');
  }
  for (const view of snapshot.views) {
    const row = viewRows.find((candidate) => candidate.key === view.key);
    if (!row || !view.nodes.length) continue;
    await trx('architecture_view_nodes').insert(view.nodes.map((node) => ({ ...node, view_id: row.id })));
  }
}

// Loads one revision only when it belongs to the requested project.
export async function getArchitectureRevision(projectId: number, revisionId: number) {
  return knex('architecture_revisions').where({ project_id: projectId, id: revisionId }).first() as Promise<RevisionRow | undefined>;
}

// Compares two revisions from the same project and returns their semantic impact.
export async function compareArchitectureRevisions(projectId: number, fromRevisionId: number, toRevisionId: number) {
  const [from, to] = await Promise.all([
    getArchitectureRevision(projectId, fromRevisionId),
    getArchitectureRevision(projectId, toRevisionId),
  ]);
  if (!from || !to) return null;
  return {
    from: { ...from, snapshot_json: undefined },
    to: { ...to, snapshot_json: undefined },
    diff: diffArchitectureGraphs(parseSnapshot(from.snapshot_json), parseSnapshot(to.snapshot_json)),
  } as { from: Omit<RevisionRow, 'snapshot_json'>; to: Omit<RevisionRow, 'snapshot_json'>; diff: ArchitectureRevisionDiff };
}

// Creates a new revision restoring an earlier snapshot while preserving all intermediate history.
export async function revertArchitectureRevision(projectId: number, userId: number, targetRevisionId: number) {
  return knex.transaction(async (trx) => {
    const draft = await trx('architecture_drafts').where({ project_id: projectId }).forUpdate().first();
    const target = await trx('architecture_revisions').where({ project_id: projectId, id: targetRevisionId }).first() as RevisionRow | undefined;
    if (!draft || !target) return null;

    const current = await trx('architecture_revisions').where({ project_id: projectId, id: draft.base_revision_id }).forUpdate().first();
    if (!current) return null;
    const snapshot = parseSnapshot(target.snapshot_json);
    await restoreSnapshot(trx, projectId, snapshot);
    const [revision] = await trx('architecture_revisions').insert({
      project_id: projectId,
      version: Number(current.version) + 1,
      parent_revision_id: current.id,
      created_by: userId,
      snapshot_json: snapshot,
      summary: `Reverted to revision ${target.version}`,
    }).returning('*');
    await trx('architecture_drafts').where({ project_id: projectId }).update({ base_revision_id: revision.id, updated_by: userId, updated_at: trx.fn.now() });
    return revision as ArchitectureRevision;
  });
}

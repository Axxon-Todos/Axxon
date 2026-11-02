// Builds immutable architecture change-set previews, semantic diffs, and deterministic impact findings.
import { createHash } from 'node:crypto';
import db from '@/lib/db/db';
import type { Knex } from 'knex';
import { Architecture } from '@/lib/models/architecture';
import { ArchitectureRequirements } from '@/lib/models/architectureRequirements';
import type { ArchitectureGraph } from '@/lib/types/architectureTypes';
import { validateArchitectureDraft } from '@/lib/utils/architectureValidation';
import type { ArchitectureChangeProposal, ArchitectureImpactFinding, ArchitectureSemanticDiff } from './contracts';
import { applyArchitectureOperations } from './operations';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stable(entry)]));
  return value;
}

// Returns a deterministic hash for a graph snapshot, independent of database key ordering.
export function architectureContentHash(graph: ArchitectureGraph) {
  return createHash('sha256').update(JSON.stringify(stable(graph))).digest('hex');
}

function diffEntities(before: ArchitectureGraph, after: ArchitectureGraph): ArchitectureSemanticDiff {
  const beforeComponents = new Map(before.components.map((item) => [item.id, item]));
  const afterComponents = new Map(after.components.map((item) => [item.id, item]));
  const beforeRelationships = new Map(before.relationships.map((item) => [item.id, item]));
  const afterRelationships = new Map(after.relationships.map((item) => [item.id, item]));
  const added: ArchitectureSemanticDiff['added'] = [];
  const modified: ArchitectureSemanticDiff['modified'] = [];
  const removed: ArchitectureSemanticDiff['removed'] = [];
  const affected: ArchitectureSemanticDiff['affected'] = [];
  for (const [id, item] of afterComponents) {
    if (!beforeComponents.has(id)) added.push({ entityType: 'component', id, name: item.name, type: item.type });
    else {
      const previous = beforeComponents.get(id)!;
      const fields = Object.keys(item).filter((key) => JSON.stringify((item as any)[key]) !== JSON.stringify((previous as any)[key]) && !['updated_at', 'created_at'].includes(key));
      if (fields.length) modified.push({ entityType: 'component', id, fields });
    }
  }
  for (const [id, item] of beforeComponents) if (!afterComponents.has(id)) removed.push({ entityType: 'component', id, name: item.name, type: item.type });
  for (const [id, item] of afterRelationships) {
    if (!beforeRelationships.has(id)) added.push({ entityType: 'relationship', id, type: item.type });
    else {
      const previous = beforeRelationships.get(id)!;
      const fields = Object.keys(item).filter((key) => JSON.stringify((item as any)[key]) !== JSON.stringify((previous as any)[key]) && !['updated_at', 'created_at'].includes(key));
      if (fields.length) modified.push({ entityType: 'relationship', id, fields });
    }
  }
  for (const [id, item] of beforeRelationships) if (!afterRelationships.has(id)) removed.push({ entityType: 'relationship', id, type: item.type });
  const changedComponents = new Set([...added, ...modified, ...removed].filter((item) => item.entityType === 'component').map((item) => item.id));
  for (const relationship of before.relationships.concat(after.relationships)) {
    if (changedComponents.has(relationship.source_component_id) || changedComponents.has(relationship.target_component_id)) {
      if (!modified.some((item) => item.id === relationship.id) && !added.some((item) => item.id === relationship.id) && !removed.some((item) => item.id === relationship.id)) affected.push({ entityType: 'relationship', id: relationship.id, reason: 'Connected to a changed component' });
    }
  }
  return { added, modified, removed, affected };
}

function impactFindings(before: ArchitectureGraph, after: ArchitectureGraph, diff: ArchitectureSemanticDiff): ArchitectureImpactFinding[] {
  const findings: ArchitectureImpactFinding[] = [];
  for (const removal of diff.removed.filter((item) => item.entityType === 'component')) {
    const connected = before.relationships.filter((relationship) => relationship.source_component_id === removal.id || relationship.target_component_id === removal.id);
    if (connected.length) findings.push({ severity: 'warning', entityType: 'component', entityId: removal.id, message: `Removing this component also removes ${connected.length} connected relationship(s).` });
  }
  for (const change of diff.modified.filter((item) => item.entityType === 'component')) {
    const component = after.components.find((entry) => entry.id === change.id);
    if (component?.type === 'security_control' || change.fields.includes('constraints')) findings.push({ severity: 'warning', entityType: 'component', entityId: change.id, message: 'Security or constraint metadata changed and should be reviewed against operational requirements.' });
  }
  return findings;
}

export async function buildArchitectureChangeSet(projectId: number, runId: number, userId: number, proposal: ArchitectureChangeProposal, baseGraph: ArchitectureGraph) {
  const proposedGraph = applyArchitectureOperations(baseGraph, proposal.operations, projectId);
  const semanticDiff = diffEntities(baseGraph, proposedGraph);
  const impact = impactFindings(baseGraph, proposedGraph, semanticDiff);
  const requirements = await ArchitectureRequirements.list(projectId);
  for (const requirement of requirements.filter((item) => item.status === 'unresolved' && item.blocking)) impact.push({ severity: 'blocking', entityType: 'requirement', entityId: String(requirement.id), message: `Blocking requirement remains unresolved: ${requirement.title}` });
  return {
    project_id: projectId,
    run_id: runId,
    base_revision_id: proposal.baseRevisionId,
    base_content_hash: architectureContentHash(baseGraph),
    operations_json: proposal.operations,
    proposed_graph_json: proposedGraph,
    semantic_diff_json: semanticDiff,
    impact_findings_json: impact,
    validation_json: { valid: true, operationCount: proposal.operations.length },
    assumptions_json: proposal.assumptions,
    risks_json: proposal.risks,
    provenance_json: { source: 'architecture-agent', userId, intent: proposal.intent },
    status: 'pending_review',
  };
}

// Serializes every JSONB payload explicitly while preserving the shape expected by approval and review code.
function encodeJsonb(value: unknown, field: string, shape: 'array' | 'object') {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    const normalized = parsed == null ? (shape === 'array' ? [] : {}) : parsed;
    if (shape === 'array' && !Array.isArray(normalized)) throw new Error('expected an array');
    if (shape === 'object' && (typeof normalized !== 'object' || Array.isArray(normalized))) throw new Error('expected an object');
    const encoded = JSON.stringify(normalized);
    if (encoded === undefined) throw new Error('value is not JSON serializable');
    return encoded;
  } catch (error) {
    throw new Error(`Architecture change-set ${field} is not JSON serializable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export class ArchitectureChangeSets {
  // Persists one immutable proposal preview for a run.
  static async create(input: Awaited<ReturnType<typeof buildArchitectureChangeSet>>, trx = db) {
    const [row] = await trx('architecture_change_sets').insert({
      ...input,
      operations_json: encodeJsonb(input.operations_json, 'operations', 'array'),
      proposed_graph_json: encodeJsonb(input.proposed_graph_json, 'proposed graph', 'object'),
      semantic_diff_json: encodeJsonb(input.semantic_diff_json, 'semantic diff', 'object'),
      impact_findings_json: encodeJsonb(input.impact_findings_json, 'impact findings', 'array'),
      validation_json: encodeJsonb(input.validation_json, 'validation', 'object'),
      assumptions_json: encodeJsonb(input.assumptions_json, 'assumptions', 'array'),
      risks_json: encodeJsonb(input.risks_json, 'risks', 'array'),
      provenance_json: encodeJsonb(input.provenance_json, 'provenance', 'object'),
    }).returning('*');
    return row;
  }

  // Retrieves the authoritative change set associated with a project run.
  static async getByRun(runId: number, trx = db) {
    return trx('architecture_change_sets').where({ run_id: runId }).orderBy('created_at', 'desc').first();
  }

  // Marks a change set as reviewed without changing its immutable operations or preview.
  static async markReviewed(id: number, userId: number, status: 'approved' | 'changes_requested', feedback: string | null, trx = db) {
    const [row] = await trx('architecture_change_sets').where({ id }).update({ status, reviewed_by: userId, review_feedback: feedback, reviewed_at: trx.fn.now(), updated_at: trx.fn.now() }).returning('*');
    return row;
  }

  // Locks the draft before verifying revision identity, graph hash, and proposal graph validity in one transaction.
  static async assertCurrent(changeSet: any, projectId: number, trx: Knex.Transaction) {
    const draft = await trx('architecture_drafts').where({ project_id: projectId }).forUpdate().first();
    if (!draft || Number(draft.base_revision_id) !== Number(changeSet.base_revision_id)) throw new Error('Architecture proposal is stale; refresh it against the latest draft before approval');
    const currentRevision = await trx('architecture_revisions').where({ id: changeSet.base_revision_id, project_id: projectId }).first();
    const graph = await Architecture.getGraphWithTransaction(projectId, trx);
    if (!currentRevision || architectureContentHash(graph) !== changeSet.base_content_hash) throw new Error('Architecture proposal is stale; refresh it against the latest draft before approval');
    validateArchitectureDraft({ base_revision_id: Number(changeSet.base_revision_id), components: changeSet.proposed_graph_json.components, relationships: changeSet.proposed_graph_json.relationships, views: changeSet.proposed_graph_json.views });
    return graph;
  }
}

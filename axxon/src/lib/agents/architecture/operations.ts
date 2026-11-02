// Validates architecture-agent operations against a graph without persisting or mutating canonical state.
import type { ArchitectureComponent, ArchitectureGraph, ArchitectureRelationship } from '@/lib/types/architectureTypes';
import type { ArchitectureChangeProposal, ArchitectureOperation } from './contracts';
import { validateArchitectureDraft } from '@/lib/utils/architectureValidation';

// Rejects provider output that tries to mutate identity or persistence-only fields.
function assertAllowedChanges(changes: Record<string, unknown>, allowed: string[], target: string) {
  const invalid = Object.keys(changes).filter((key) => !allowed.includes(key));
  if (invalid.length) throw new Error(`Unsupported ${target} fields: ${invalid.join(', ')}`);
}

// Coerces model output into JSONB-safe values before a proposal can reach persistence.
function parseJsonValue(value: unknown, fallback: unknown) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

// Normalizes component fields that are stored as JSONB arrays or objects.
function normalizeComponent(component: Record<string, unknown>) {
  const next = { ...component };
  for (const key of ['responsibilities', 'technologies', 'requirements', 'constraints']) {
    const value = parseJsonValue(next[key], []);
    next[key] = Array.isArray(value) ? value.filter((entry: unknown): entry is string => typeof entry === 'string') : [];
  }
  const metadata = parseJsonValue(next.metadata, {});
  next.metadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  return next;
}

// Normalizes relationship metadata stored in JSONB.
function normalizeRelationship(relationship: any) {
  const next = { ...relationship };
  const metadata = parseJsonValue(next.metadata, {});
  next.metadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  return next;
}

// Applies a reviewed operation set to an in-memory graph and validates the complete result.
export function applyArchitectureOperations(graph: ArchitectureGraph, operations: ArchitectureOperation[], projectId?: number) {
  const next = structuredClone(graph);
  for (const operation of operations) {
    if (operation.type === 'add_component') next.components.push({ ...normalizeComponent(operation.component as unknown as Record<string, unknown>), project_id: projectId || next.components[0]?.project_id || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as ArchitectureComponent);
    if (operation.type === 'update_component') {
      const component = next.components.find((entry) => entry.id === operation.componentId);
      if (!component) throw new Error(`Unknown component: ${operation.componentId}`);
      assertAllowedChanges(operation.changes as Record<string, unknown>, ['type', 'name', 'description', 'parent_id', 'responsibilities', 'technologies', 'requirements', 'constraints', 'metadata'], 'component');
      Object.assign(component, normalizeComponent({ ...component, ...operation.changes } as unknown as Record<string, unknown>), { updated_at: new Date().toISOString() });
    }
    if (operation.type === 'remove_component') {
      if (!next.components.some((component) => component.id === operation.componentId)) throw new Error(`Unknown component: ${operation.componentId}`);
      next.components = next.components.filter((component) => component.id !== operation.componentId);
      next.relationships = next.relationships.filter((relationship) => relationship.source_component_id !== operation.componentId && relationship.target_component_id !== operation.componentId);
      next.views = next.views.map((view) => ({ ...view, nodes: view.nodes.filter((node) => node.component_id !== operation.componentId) }));
    }
    if (operation.type === 'add_relationship') next.relationships.push({ ...normalizeRelationship(operation.relationship), project_id: projectId || next.components[0]?.project_id || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as ArchitectureRelationship);
    if (operation.type === 'update_relationship') {
      const relationship = next.relationships.find((entry) => entry.id === operation.relationshipId);
      if (!relationship) throw new Error(`Unknown relationship: ${operation.relationshipId}`);
      assertAllowedChanges(operation.changes as Record<string, unknown>, ['source_component_id', 'target_component_id', 'type', 'label', 'metadata'], 'relationship');
      Object.assign(relationship, normalizeRelationship({ ...relationship, ...operation.changes }), { updated_at: new Date().toISOString() });
    }
    if (operation.type === 'remove_relationship') {
      if (!next.relationships.some((relationship) => relationship.id === operation.relationshipId)) throw new Error(`Unknown relationship: ${operation.relationshipId}`);
      next.relationships = next.relationships.filter((relationship) => relationship.id !== operation.relationshipId);
    }
    if (!['add_component', 'update_component', 'remove_component', 'add_relationship', 'update_relationship', 'remove_relationship'].includes(operation.type)) {
      throw new Error(`Unsupported architecture operation: ${String(operation.type)}`);
    }
  }
  validateArchitectureDraft({ base_revision_id: 0, components: next.components, relationships: next.relationships, views: next.views });
  return next;
}

// Validates a proposal and returns the graph that would be persisted after approval.
export function validateArchitectureProposal(graph: ArchitectureGraph, proposal: ArchitectureChangeProposal, projectId?: number) {
  if (!proposal.summary.trim()) throw new Error('Architecture proposals require a summary');
  if (proposal.operations.length === 0) throw new Error('Architecture proposals require at least one operation');
  return applyArchitectureOperations(graph, proposal.operations, projectId);
}

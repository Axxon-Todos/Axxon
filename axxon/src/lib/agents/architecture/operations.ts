// Validates architecture-agent operations against a graph without persisting or mutating canonical state.
import type { ArchitectureGraph } from '@/lib/types/architectureTypes';
import type { ArchitectureChangeProposal, ArchitectureOperation } from './contracts';
import { validateArchitectureDraft } from '@/lib/utils/architectureValidation';

export function applyArchitectureOperations(graph: ArchitectureGraph, operations: ArchitectureOperation[]) {
  const next = structuredClone(graph);
  for (const operation of operations) {
    if (operation.type === 'add_component') next.components.push({ ...operation.component, project_id: next.components[0]?.project_id || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    if (operation.type === 'update_component') {
      const component = next.components.find((entry) => entry.id === operation.componentId);
      if (!component) throw new Error(`Unknown component: ${operation.componentId}`);
      Object.assign(component, operation.changes, { updated_at: new Date().toISOString() });
    }
    if (operation.type === 'remove_component') {
      next.components = next.components.filter((component) => component.id !== operation.componentId);
      next.relationships = next.relationships.filter((relationship) => relationship.source_component_id !== operation.componentId && relationship.target_component_id !== operation.componentId);
      next.views = next.views.map((view) => ({ ...view, nodes: view.nodes.filter((node) => node.component_id !== operation.componentId) }));
    }
    if (operation.type === 'add_relationship') next.relationships.push({ ...operation.relationship, project_id: next.components[0]?.project_id || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    if (operation.type === 'update_relationship') {
      const relationship = next.relationships.find((entry) => entry.id === operation.relationshipId);
      if (!relationship) throw new Error(`Unknown relationship: ${operation.relationshipId}`);
      Object.assign(relationship, operation.changes, { updated_at: new Date().toISOString() });
    }
    if (operation.type === 'remove_relationship') next.relationships = next.relationships.filter((relationship) => relationship.id !== operation.relationshipId);
  }
  validateArchitectureDraft({ base_revision_id: 0, components: next.components, relationships: next.relationships, views: next.views });
  return next;
}

export function validateArchitectureProposal(graph: ArchitectureGraph, proposal: ArchitectureChangeProposal) {
  if (!proposal.summary.trim()) throw new Error('Architecture proposals require a summary');
  if (proposal.operations.length === 0) throw new Error('Architecture proposals require at least one operation');
  return applyArchitectureOperations(graph, proposal.operations);
}

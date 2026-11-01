// Validates architecture graph mutations before they can be persisted or proposed by an agent.
import { architectureComponentTypes, architectureRelationshipTypes, type ArchitectureDraftInput } from '@/lib/types/architectureTypes';

export function validateArchitectureDraft(input: ArchitectureDraftInput) {
  const componentIds = new Set<string>();
  for (const component of input.components) {
    if (componentIds.has(component.id)) throw new Error(`Duplicate component id: ${component.id}`);
    componentIds.add(component.id);
    if (!architectureComponentTypes.includes(component.type)) throw new Error(`Invalid component type: ${component.type}`);
    if (!component.name.trim()) throw new Error('Architecture components require a name');
  }

  for (const component of input.components) {
    if (component.parent_id && !componentIds.has(component.parent_id)) throw new Error(`Unknown parent component: ${component.parent_id}`);
  }

  for (const component of input.components) {
    const visited = new Set<string>();
    let cursor = component.parent_id;
    while (cursor) {
      if (cursor === component.id || visited.has(cursor)) throw new Error('Architecture hierarchy contains a cycle');
      visited.add(cursor);
      cursor = input.components.find((entry) => entry.id === cursor)?.parent_id ?? null;
    }
  }

  const relationshipIds = new Set<string>();
  for (const relationship of input.relationships) {
    if (relationshipIds.has(relationship.id)) throw new Error(`Duplicate relationship id: ${relationship.id}`);
    relationshipIds.add(relationship.id);
    if (!architectureRelationshipTypes.includes(relationship.type)) throw new Error(`Invalid relationship type: ${relationship.type}`);
    if (!componentIds.has(relationship.source_component_id) || !componentIds.has(relationship.target_component_id)) {
      throw new Error(`Relationship ${relationship.id} references an unknown component`);
    }
    if (relationship.source_component_id === relationship.target_component_id) throw new Error('A component cannot relate to itself');
  }

  const viewKeys = new Set<string>();
  for (const view of input.views) {
    if (viewKeys.has(view.key)) throw new Error(`Duplicate architecture view: ${view.key}`);
    viewKeys.add(view.key);
    for (const node of view.nodes) {
      if (!componentIds.has(node.component_id)) throw new Error(`View ${view.key} references an unknown component`);
    }
  }
}

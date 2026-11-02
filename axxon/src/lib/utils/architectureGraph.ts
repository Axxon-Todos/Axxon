// Projects the canonical architecture graph into focused views and infers low-friction relationship types.
import type { ArchitectureComponent, ArchitectureComponentType, ArchitectureGraph, ArchitectureRelationshipType, ArchitectureViewKey } from '@/lib/types/architectureTypes';
import { architectureComponentCatalog } from '@/lib/types/architectureTypes';

const catalogByType = new Map(architectureComponentCatalog.map((entry) => [entry.type, entry]));

function isComponentInView(component: ArchitectureComponent, viewKey: ArchitectureViewKey) {
  if (viewKey === 'overview') return true;
  return catalogByType.get(component.type)?.defaultViews.includes(viewKey) ?? false;
}

// Returns focused nodes and a one-hop dependency context without duplicating canonical entities.
export function projectArchitectureGraph(graph: ArchitectureGraph, viewKey: ArchitectureViewKey) {
  const primaryIds = new Set(graph.components.filter((component) => isComponentInView(component, viewKey)).map((component) => component.id));
  const contextIds = new Set<string>();
  if (viewKey !== 'overview') {
    for (const relationship of graph.relationships) {
      if (primaryIds.has(relationship.source_component_id)) contextIds.add(relationship.target_component_id);
      if (primaryIds.has(relationship.target_component_id)) contextIds.add(relationship.source_component_id);
    }
  }
  // Keep ancestry visible so focused views do not detach a subsystem from its owner.
  const visibleIds = new Set([...primaryIds, ...contextIds]);
  for (const component of graph.components) {
    let parentId = component.parent_id;
    const visitedParents = new Set<string>();
    while (parentId) {
      if (visitedParents.has(parentId)) break;
      visitedParents.add(parentId);
      visibleIds.add(parentId);
      parentId = graph.components.find((candidate) => candidate.id === parentId)?.parent_id ?? null;
    }
  }
  return {
    primaryIds,
    contextIds,
    components: graph.components.filter((component) => visibleIds.has(component.id)),
    relationships: graph.relationships.filter((relationship) => visibleIds.has(relationship.source_component_id) && visibleIds.has(relationship.target_component_id)),
  };
}

// Returns the immediate children of a component without changing canonical IDs.
export function getArchitectureChildren(components: ArchitectureComponent[], parentId: string | null) {
  return components.filter((component) => component.parent_id === parentId);
}

// Returns every descendant below a component, used to collapse a subsystem safely.
export function getArchitectureDescendantIds(components: ArchitectureComponent[], parentId: string) {
  const descendants = new Set<string>();
  const pending = [parentId];
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    for (const child of components) {
      if (child.parent_id === current && !descendants.has(child.id)) {
        descendants.add(child.id);
        pending.push(child.id);
      }
    }
  }
  return descendants;
}

// Suggests a relationship while preserving a generic dependency fallback for ambiguous pairs.
export function inferArchitectureRelationshipType(source: ArchitectureComponent | undefined, target: ArchitectureComponent | undefined): ArchitectureRelationshipType {
  if (!source || !target) return 'depends_on';
  const sourceEntry = catalogByType.get(source.type);
  const targetEntry = catalogByType.get(target.type);
  const targetTypes = new Set<ArchitectureComponentType>(['database', 'storage', 'cache']);
  if (targetTypes.has(target.type)) return source.type === 'service' || source.type === 'backend_domain' ? 'writes_to' : 'reads_from';
  if (target.type === 'api' || target.type === 'gateway' || target.type === 'external_service' || target.type === 'integration') return 'calls';
  if (source.type === 'queue' || source.type === 'event_bus') return 'publishes_to';
  if (sourceEntry?.suggestedRelationships.includes('calls') && targetEntry?.category === 'backend') return 'calls';
  return sourceEntry?.suggestedRelationships[0] || 'depends_on';
}

// Chooses the nearest node sides for a relationship so the canvas routes from any side naturally.
export function getConnectionPositions(source: { x: number; y: number; width?: number; height?: number }, target: { x: number; y: number; width?: number; height?: number }) {
  const sourceCenter = { x: source.x + (source.width || 180) / 2, y: source.y + (source.height || 90) / 2 };
  const targetCenter = { x: target.x + (target.width || 180) / 2, y: target.y + (target.height || 90) / 2 };
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { sourcePosition: dx >= 0 ? 'right' as const : 'left' as const, targetPosition: dx >= 0 ? 'left' as const : 'right' as const };
  return { sourcePosition: dy >= 0 ? 'bottom' as const : 'top' as const, targetPosition: dy >= 0 ? 'top' as const : 'bottom' as const };
}

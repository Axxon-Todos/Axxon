// Builds a stable semantic diff between two architecture revision snapshots.
import type { ArchitectureGraph } from '@/lib/types/architectureTypes';

export type ArchitectureRevisionDiff = {
  addedComponents: string[];
  removedComponents: string[];
  changedComponents: string[];
  addedRelationships: string[];
  removedRelationships: string[];
  changedRelationships: string[];
  addedViews: string[];
  removedViews: string[];
  changedViews: string[];
  affectedComponents: string[];
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

// Removes persistence-only fields so timestamps do not appear as architecture changes.
function semanticEntity<T extends { id: string }>(entity: T) {
  const { id, project_id: _projectId, created_at: _createdAt, updated_at: _updatedAt, ...content } = entity as T & { project_id?: unknown; created_at?: unknown; updated_at?: unknown };
  return { id, ...content };
}

// Returns IDs whose serialized entity content differs between two snapshots.
function diffEntities<T extends { id: string }>(before: T[], after: T[]) {
  const beforeById = new Map(before.map((entity) => [entity.id, entity]));
  const afterById = new Map(after.map((entity) => [entity.id, entity]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [id, entity] of afterById) {
    if (!beforeById.has(id)) added.push(id);
    else if (stableJson(semanticEntity(beforeById.get(id)!)) !== stableJson(semanticEntity(entity))) changed.push(id);
  }
  for (const id of beforeById.keys()) if (!afterById.has(id)) removed.push(id);

  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

// Computes graph-level changes and the component impact set for revision review.
export function diffArchitectureGraphs(before: ArchitectureGraph, after: ArchitectureGraph): ArchitectureRevisionDiff {
  const components = diffEntities(before.components, after.components);
  const relationships = diffEntities(before.relationships, after.relationships);
  const beforeViews = new Map(before.views.map((view) => [view.key, view]));
  const afterViews = new Map(after.views.map((view) => [view.key, view]));
  const addedViews = [...afterViews.keys()].filter((key) => !beforeViews.has(key)).sort();
  const removedViews = [...beforeViews.keys()].filter((key) => !afterViews.has(key)).sort();
  const changedViews = [...afterViews.keys()].filter((key) => beforeViews.has(key)
    && stableJson(beforeViews.get(key)) !== stableJson(afterViews.get(key))).sort();
  const affectedComponents = new Set<string>([
    ...components.added,
    ...components.removed,
    ...components.changed,
  ]);

  for (const relationship of [...before.relationships, ...after.relationships]) {
    if ([...relationships.added, ...relationships.removed, ...relationships.changed].includes(relationship.id)) {
      affectedComponents.add(relationship.source_component_id);
      affectedComponents.add(relationship.target_component_id);
    }
  }

  for (const key of [...addedViews, ...removedViews, ...changedViews]) {
    for (const node of [...(beforeViews.get(key)?.nodes ?? []), ...(afterViews.get(key)?.nodes ?? [])]) {
      affectedComponents.add(node.component_id);
    }
  }

  return {
    addedComponents: components.added,
    removedComponents: components.removed,
    changedComponents: components.changed,
    addedRelationships: relationships.added,
    removedRelationships: relationships.removed,
    changedRelationships: relationships.changed,
    addedViews,
    removedViews,
    changedViews,
    affectedComponents: [...affectedComponents].sort(),
  };
}

// Verifies semantic revision diff coverage for architecture review and rollback UX.
import { describe, expect, it } from 'vitest';
import { diffArchitectureGraphs } from '@/lib/utils/architectureRevisionDiff';
import type { ArchitectureGraph } from '@/lib/types/architectureTypes';

const graph = (components: ArchitectureGraph['components'], relationships: ArchitectureGraph['relationships']): ArchitectureGraph => ({ components, relationships, views: [] });
const component = (id: string, name = id) => ({ id, project_id: 1, type: 'service' as const, name, description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {}, created_at: '', updated_at: '' });
const relationship = (id: string, source_component_id: string, target_component_id: string) => ({ id, project_id: 1, source_component_id, target_component_id, type: 'calls' as const, label: null, metadata: {}, created_at: '', updated_at: '' });

describe('architecture revision diff', () => {
  it('reports entity changes and impacted relationship endpoints', () => {
    const before = graph([component('a'), component('b')], [relationship('r', 'a', 'b')]);
    const after = graph([component('a', 'renamed'), component('c')], [relationship('r2', 'a', 'c')]);
    expect(diffArchitectureGraphs(before, after)).toEqual({
      addedComponents: ['c'],
      removedComponents: ['b'],
      changedComponents: ['a'],
      addedRelationships: ['r2'],
      removedRelationships: ['r'],
      changedRelationships: [],
      affectedComponents: ['a', 'b', 'c'],
    });
  });
});

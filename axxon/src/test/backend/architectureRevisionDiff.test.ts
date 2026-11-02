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
      addedViews: [],
      removedViews: [],
      changedViews: [],
      affectedComponents: ['a', 'b', 'c'],
    });
  });

  it('ignores persistence timestamps when graph content is unchanged', () => {
    const before = graph([component('a')], []);
    const after = graph([{ ...component('a'), created_at: 'later', updated_at: 'later' }], []);
    expect(diffArchitectureGraphs(before, after).changedComponents).toEqual([]);
  });

  it('reports view layout and filter changes as impacted components', () => {
    const before = { ...graph([component('a')], []), views: [{ id: 1, project_id: 1, key: 'overview' as const, name: 'Overview', description: 'Before', filter_json: {}, nodes: [{ component_id: 'a', position_x: 0, position_y: 0, hidden: false }] }] };
    const after = { ...before, views: [{ ...before.views[0], description: 'After', nodes: [{ ...before.views[0].nodes[0], position_x: 100 }] }] };
    const diff = diffArchitectureGraphs(before, after);
    expect(diff.changedViews).toEqual(['overview']);
    expect(diff.affectedComponents).toEqual(['a']);
  });

  it('does not treat the initial empty view snapshot as added catalog views', () => {
    const after = { ...graph([component('a')], []), views: [{ id: 1, project_id: 1, key: 'overview' as const, name: 'Overview', description: 'Overview', filter_json: {}, nodes: [] }] };
    const diff = diffArchitectureGraphs({ components: [], relationships: [], views: [] }, after);
    expect(diff.addedViews).toEqual([]);
    expect(diff.changedViews).toEqual([]);
  });

  it('ignores persistence fields when comparing views', () => {
    const before = { ...graph([], []), views: [{ id: 1, project_id: 1, key: 'overview' as const, name: 'Overview', description: 'Overview', filter_json: {}, nodes: [] }] };
    const after = { ...before, views: [{ ...before.views[0], id: 99, updated_at: 'later' }] };
    expect(diffArchitectureGraphs(before, after).changedViews).toEqual([]);
  });
});

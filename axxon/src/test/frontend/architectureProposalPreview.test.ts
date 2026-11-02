// Verifies proposal previews apply the complete operation set without mutating the canonical graph.
import { describe, expect, it } from 'vitest';
import { buildArchitectureProposalTopology } from '@/components/features/projects/ArchitectureProposalPreview';
import type { ArchitectureGraph } from '@/lib/types/architectureTypes';

const graph: ArchitectureGraph = {
  components: [
    { id: 'api', project_id: 1, type: 'api', name: 'API', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {}, created_at: 'a', updated_at: 'a' },
    { id: 'db', project_id: 1, type: 'database', name: 'Database', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {}, created_at: 'a', updated_at: 'a' },
  ],
  relationships: [{ id: 'api-db', project_id: 1, source_component_id: 'api', target_component_id: 'db', type: 'writes_to', label: 'persists', metadata: {}, created_at: 'a', updated_at: 'a' }],
  views: [{ id: 1, project_id: 1, key: 'overview', name: 'Overview', description: 'Overview', filter_json: {}, nodes: [{ component_id: 'api', position_x: 0, position_y: 0, hidden: false }, { component_id: 'db', position_x: 240, position_y: 0, hidden: false }] }],
};

describe('architecture proposal topology preview', () => {
  it('applies component and relationship additions, updates, and removals exactly', () => {
    const topology = buildArchitectureProposalTopology(graph, [
      { type: 'add_component', component: { id: 'worker', type: 'service', name: 'Worker', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {} } },
      { type: 'update_component', componentId: 'worker', changes: { name: 'Async Worker', technologies: ['Node.js'] } },
      { type: 'update_relationship', relationshipId: 'api-db', changes: { type: 'reads_from', label: 'reads' } },
      { type: 'add_relationship', relationship: { id: 'api-worker', source_component_id: 'api', target_component_id: 'worker', type: 'calls', label: 'dispatches', metadata: {} } },
      { type: 'remove_relationship', relationshipId: 'api-db' },
    ]);

    expect(topology.componentCount).toBe(3);
    expect(topology.relationshipCount).toBe(1);
    expect(topology.components.map((component) => component.id)).toEqual(['api', 'db', 'worker']);
    expect(topology.components.find((component) => component.id === 'worker')?.name).toBe('Async Worker');
    expect(topology.relationships.map((relationship) => relationship.id)).toEqual(['api-worker']);
  });

  it('removes connected relationships when a component is removed and preserves the source graph', () => {
    const original = structuredClone(graph);
    const topology = buildArchitectureProposalTopology(graph, [{ type: 'remove_component', componentId: 'db' }]);

    expect(topology.componentCount).toBe(1);
    expect(topology.relationshipCount).toBe(0);
    expect(graph).toEqual(original);
    expect(topology.graph).not.toBe(graph);
    expect(topology.graph.relationships).not.toBe(graph.relationships);
  });

  it('uses the persisted proposed graph when one is supplied', () => {
    const persistedGraph = { ...graph, components: [graph.components[0]], relationships: [], views: graph.views };
    const topology = buildArchitectureProposalTopology(graph, [{ type: 'add_component', component: { id: 'ignored', type: 'service', name: 'Ignored', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {} } }], persistedGraph);

    expect(topology.components.map((component) => component.id)).toEqual(['api']);
    expect(topology.relationshipCount).toBe(0);
  });
});

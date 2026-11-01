// Verifies scoped architecture-agent context and non-persistent proposal validation.
import { describe, expect, it } from 'vitest';
import { applyArchitectureOperations } from '@/lib/agents/architecture/operations';
import type { ArchitectureGraph } from '@/lib/types/architectureTypes';

const graph = {
  components: [
    { id: 'api', project_id: 1, type: 'api', name: 'API', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {}, created_at: '', updated_at: '' },
  ],
  relationships: [],
  views: [{ id: 1, project_id: 1, key: 'overview', name: 'Overview', description: 'Overview', filter_json: {}, nodes: [{ component_id: 'api', position_x: 0, position_y: 0, hidden: false }] }],
} as ArchitectureGraph;

describe('architecture agent operations', () => {
  it('applies a valid proposal only to an in-memory graph', () => {
    const next = applyArchitectureOperations(graph, [{ type: 'add_component', component: { id: 'service', type: 'service', name: 'Service', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {} } }]);
    expect(next.components).toHaveLength(2);
    expect(graph.components).toHaveLength(1);
  });

  it('rejects operations that leave dangling relationships', () => {
    expect(() => applyArchitectureOperations(graph, [{ type: 'add_relationship', relationship: { id: 'bad', source_component_id: 'api', target_component_id: 'missing', type: 'calls', label: null, metadata: {} } }])).toThrow('unknown component');
  });
});

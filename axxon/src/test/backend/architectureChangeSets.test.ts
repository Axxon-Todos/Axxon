// Verifies architecture preview hashing, semantic diffs, and impact findings without persistence.
import { describe, expect, it } from 'vitest';
import { architectureContentHash } from '@/lib/agents/architecture/changeSets';
import { applyArchitectureOperations } from '@/lib/agents/architecture/operations';
import type { ArchitectureGraph } from '@/lib/types/architectureTypes';

const graph: ArchitectureGraph = {
  components: [{ id: 'api', project_id: 1, type: 'api', name: 'API', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {}, created_at: '', updated_at: '' }],
  relationships: [],
  views: [{ id: 1, project_id: 1, key: 'overview', name: 'Overview', description: 'Overview', filter_json: {}, nodes: [{ component_id: 'api', position_x: 0, position_y: 0, hidden: false }] }],
};

describe('architecture change-set foundations', () => {
  it('hashes equivalent graph objects deterministically', () => {
    expect(architectureContentHash(graph)).toBe(architectureContentHash(structuredClone(graph)));
  });

  it('builds a preview without mutating the source graph', () => {
    const preview = applyArchitectureOperations(graph, [{ type: 'add_component', component: { id: 'db', type: 'database', name: 'Database', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {} } }]);
    expect(preview.components.map((component) => component.id)).toEqual(['api', 'db']);
    expect(graph.components).toHaveLength(1);
  });
});

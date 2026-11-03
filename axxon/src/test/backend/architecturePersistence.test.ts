// Verifies architecture identifiers are normalized before graph persistence.
import { describe, expect, it } from 'vitest';
import { normalizeArchitectureGraphIds } from '@/lib/models/architecture';
import type { ArchitectureGraph } from '@/lib/types/architectureTypes';

describe('architecture persistence normalization', () => {
  it('remaps overlong identifiers and preserves all graph references', () => {
    const longComponentId = 'ingestion-component-0123456789abcdef0123456789';
    const longWorkerId = 'ingestion-worker-0123456789abcdef0123456789';
    const longRelationshipId = 'relationship-0123456789abcdef0123456789';
    const graph = {
      components: [
        { id: longComponentId, project_id: 9, type: 'queue', name: 'Queue', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {}, created_at: '', updated_at: '' },
        { id: longWorkerId, project_id: 9, type: 'service', name: 'Worker', description: null, parent_id: longComponentId, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {}, created_at: '', updated_at: '' },
      ],
      relationships: [{ id: longRelationshipId, project_id: 9, source_component_id: longComponentId, target_component_id: longWorkerId, type: 'subscribes_to', label: null, metadata: {}, created_at: '', updated_at: '' }],
      views: [{ id: 1, project_id: 9, key: 'overview', name: 'Overview', description: 'Overview', filter_json: {}, nodes: [{ component_id: longComponentId, position_x: 0, position_y: 0, hidden: false }, { component_id: longWorkerId, position_x: 200, position_y: 0, hidden: false }] }],
    } as ArchitectureGraph;

    const normalized = normalizeArchitectureGraphIds(graph);
    const [queue, worker] = normalized.components;

    expect(queue.id).toHaveLength(36);
    expect(worker.id).toHaveLength(36);
    expect(worker.parent_id).toBe(queue.id);
    expect(normalized.relationships[0].id).toHaveLength(36);
    expect(normalized.relationships[0].source_component_id).toBe(queue.id);
    expect(normalized.relationships[0].target_component_id).toBe(worker.id);
    expect(normalized.views[0].nodes.map((node) => node.component_id)).toEqual([queue.id, worker.id]);
  });
});

// Verifies focused graph projections, relationship inference, and smart connection geometry.
import { describe, expect, it } from 'vitest';
import { getConnectionPositions, inferArchitectureRelationshipType, projectArchitectureGraph } from '@/lib/utils/architectureGraph';
import type { ArchitectureComponent, ArchitectureGraph } from '@/lib/types/architectureTypes';

const component = (id: string, type: ArchitectureComponent['type']): ArchitectureComponent => ({ id, project_id: 1, type, name: id, description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {}, created_at: '', updated_at: '' });
const graph: ArchitectureGraph = {
  components: [component('ui', 'frontend'), component('api', 'api'), component('db', 'database'), component('metrics', 'monitoring'), component('boundary', 'trust_boundary')],
  relationships: [
    { id: 'ui-api', project_id: 1, source_component_id: 'ui', target_component_id: 'api', type: 'calls', label: null, metadata: {}, created_at: '', updated_at: '' },
    { id: 'api-db', project_id: 1, source_component_id: 'api', target_component_id: 'db', type: 'writes_to', label: null, metadata: {}, created_at: '', updated_at: '' },
  ],
  views: [],
};

describe('architecture graph utilities', () => {
  it('projects focused views while preserving one-hop dependency context', () => {
    const projection = projectArchitectureGraph(graph, 'frontend');
    expect(projection.primaryIds).toEqual(new Set(['ui']));
    expect(projection.contextIds).toEqual(new Set(['api']));
    expect(projection.components.map((entry) => entry.id)).toEqual(['ui', 'api']);
  });

  it('supports cross-cutting security and observability views', () => {
    expect(projectArchitectureGraph(graph, 'security').primaryIds).toEqual(new Set(['db', 'boundary']));
    expect(projectArchitectureGraph(graph, 'observability').primaryIds).toEqual(new Set(['metrics']));
  });

  it('infers useful relationship types for common pairs', () => {
    expect(inferArchitectureRelationshipType(component('service', 'service'), component('db', 'database'))).toBe('writes_to');
    expect(inferArchitectureRelationshipType(component('ui', 'frontend'), component('api', 'api'))).toBe('calls');
  });

  it('chooses vertical and horizontal connection sides from geometry', () => {
    expect(getConnectionPositions({ x: 0, y: 0 }, { x: 300, y: 0 })).toEqual({ sourcePosition: 'right', targetPosition: 'left' });
    expect(getConnectionPositions({ x: 0, y: 0 }, { x: 0, y: 300 })).toEqual({ sourcePosition: 'bottom', targetPosition: 'top' });
  });
});

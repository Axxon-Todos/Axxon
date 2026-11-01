// Verifies deterministic architecture graph validation before persistence or agent proposals.
import { describe, expect, it } from 'vitest';
import { validateArchitectureDraft } from '@/lib/utils/architectureValidation';

const base = {
  base_revision_id: 1,
  components: [
    { id: 'api', type: 'api' as const, name: 'API', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {} },
    { id: 'service', type: 'service' as const, name: 'Service', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {} },
  ],
  relationships: [
    { id: 'api-service', source_component_id: 'api', target_component_id: 'service', type: 'calls' as const, label: null, metadata: {} },
  ],
  views: [
    { id: 1, project_id: 1, key: 'overview' as const, name: 'Overview', description: 'Overview', filter_json: {}, nodes: [{ component_id: 'api', position_x: 0, position_y: 0, hidden: false }] },
  ],
};

describe('architecture graph validation', () => {
  it('accepts a valid graph with stable component references', () => {
    expect(() => validateArchitectureDraft(base)).not.toThrow();
  });

  it('rejects relationships that reference deleted components', () => {
    expect(() => validateArchitectureDraft({ ...base, relationships: [{ ...base.relationships[0], target_component_id: 'missing' }] })).toThrow('unknown component');
  });

  it('rejects hierarchy cycles', () => {
    expect(() => validateArchitectureDraft({ ...base, components: base.components.map((component) => ({ ...component, parent_id: component.id === 'api' ? 'service' : 'api' })) })).toThrow('cycle');
  });
});

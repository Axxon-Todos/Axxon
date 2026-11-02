// Verifies architecture-provider note recovery and strict operation validation.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateArchitectureProposalWithOllama } from '@/lib/agents/architecture/provider';
import type { AgentRun } from '@/lib/agents/domain';
import type { ArchitectureAgentContextPackage } from '@/lib/agents/architecture/contracts';
import type { ArchitectureGraph } from '@/lib/types/architectureTypes';

const run = {
  id: 37,
  organizationId: 1,
  boardId: 1,
  projectId: 9,
  architectureIntent: 'propose_change',
  targetContext: null,
  createdBy: 1,
  runType: 'architecture',
  title: 'Architecture proposal',
  prompt: 'Add a service for the workflow.',
  state: 'planning',
  version: 1,
  questions: [],
  planningContext: {},
  readiness: {},
  clarificationTurnCount: 0,
  planArtifact: null,
  failureMessage: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as AgentRun;

const graph = {
  components: [{ id: 'api', project_id: 9, type: 'api', name: 'API', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {}, created_at: '', updated_at: '' }],
  relationships: [],
  views: [{ id: 1, project_id: 9, key: 'overview', name: 'Overview', description: 'Overview', filter_json: {}, nodes: [{ component_id: 'api', position_x: 0, position_y: 0, hidden: false }] }],
} as ArchitectureGraph;

const context = {
  projectId: 9,
  revisionId: 12,
  graph,
  target: null,
  selectedComponent: null,
  selectedRelationship: null,
  dependencyNeighborhood: { components: [], relationships: [] },
  constraints: [],
  requirements: [],
  reviewerFeedback: [],
} satisfies ArchitectureAgentContextPackage;

describe('architecture Ollama provider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('normalizes object assumptions and risks while preserving useful note fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ message: { content: JSON.stringify({
        summary: 'Add a workflow service.',
        assumptions: [{ text: 'The API owns workflow requests.', rationale: 'Keeps the boundary explicit.' }],
        risks: [{ description: 'The service adds a deployment unit.', mitigation: 'Reuse the existing deployment pipeline.' }],
        operations: [{ type: 'add_component', component: { id: 'workflow', type: 'service', name: 'Workflow Service', description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {} } }],
      }) } }),
    }));

    const proposal = await generateArchitectureProposalWithOllama(run, context);

    expect(proposal.assumptions).toEqual(['The API owns workflow requests. — Rationale: Keeps the boundary explicit.']);
    expect(proposal.risks).toEqual(['The service adds a deployment unit. — Mitigation: Reuse the existing deployment pipeline.']);
  });

  it('does not normalize malformed operations into a valid proposal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ message: { content: JSON.stringify({
        summary: 'Invalid operation proposal.',
        assumptions: [{ text: 'Safe note.' }],
        risks: [],
        operations: [{ type: 'update_component', changes: { name: 'Missing component ID' } }],
      }) } }),
    }));

    await expect(generateArchitectureProposalWithOllama(run, context)).rejects.toThrow();
  });
});

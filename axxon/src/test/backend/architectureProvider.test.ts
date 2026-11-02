// Verifies architecture-provider note recovery and strict operation validation.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildArchitecturePrompt, generateArchitectureProposalWithOllama, validateArchitectureBootstrapQuality } from '@/lib/agents/architecture/provider';
import { applyArchitectureOperations } from '@/lib/agents/architecture/operations';
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

const bootstrapRun = { ...run, architectureIntent: 'bootstrap', prompt: 'Build a Rust agent telemetry ingestion system with an OpenTelemetry collector, durable event storage, WebSocket updates, and a Next.js dashboard for evals, tool calls, traces, latency, cost, and failures.' } as unknown as AgentRun;
const bootstrapContext = { ...context, graph: { components: [], relationships: [], views: [] } } satisfies ArchitectureAgentContextPackage;

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

  it('gives bootstrap generations explicit coverage and standard-default instructions', () => {
    const prompt = buildArchitecturePrompt(bootstrapRun, bootstrapContext);

    expect(prompt).toContain('application, data, ingestion, infrastructure, security, and observability');
    expect(prompt).toContain('technology decisions');
    expect(prompt).toContain('responsibilities');
    expect(prompt).toContain('Standard assumption:');
  });

  it('replaces a valid but generic bootstrap graph with the deterministic quality fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ message: { content: JSON.stringify({
        summary: 'A basic architecture.',
        assumptions: ['The system uses standard infrastructure.'],
        risks: [],
        operations: [
          { type: 'add_component', component: { id: 'frontend', type: 'application', name: 'Frontend', description: null, parent_id: null, responsibilities: ['Render workflows'], technologies: ['React'], requirements: [], constraints: [], metadata: {} } },
          { type: 'add_component', component: { id: 'api', type: 'service', name: 'API', description: null, parent_id: null, responsibilities: ['Handle requests'], technologies: ['Node.js'], requirements: [], constraints: [], metadata: {} } },
          { type: 'add_component', component: { id: 'db', type: 'database', name: 'Database', description: null, parent_id: null, responsibilities: ['Persist records'], technologies: ['PostgreSQL'], requirements: [], constraints: [], metadata: {} } },
          { type: 'add_relationship', relationship: { id: 'frontend-api', source_component_id: 'frontend', target_component_id: 'api', type: 'calls', label: null, metadata: {} } },
          { type: 'add_relationship', relationship: { id: 'api-db', source_component_id: 'api', target_component_id: 'db', type: 'writes_to', label: null, metadata: {} } },
        ],
      }) } }),
    }));

    const proposal = await generateArchitectureProposalWithOllama(bootstrapRun, bootstrapContext);
    const generatedGraph = applyArchitectureOperations(bootstrapContext.graph, proposal.operations, 9);

    expect(generatedGraph.components).toHaveLength(10);
    expect(proposal.assumptions.filter((assumption) => assumption.startsWith('Standard assumption:'))).toHaveLength(5);
    expect(proposal.operations).toHaveLength(21);
    expect(proposal.technicalDecisions).toHaveLength(6);
    expect(generatedGraph.components.map((component) => component.name)).toEqual(expect.arrayContaining(['Ingestion Queue', 'Ingestion Worker', 'Observability Stack', 'Raw Ingestion Storage']));
    expect(() => validateArchitectureBootstrapQuality(generatedGraph, proposal.assumptions, proposal.technicalDecisions)).not.toThrow();
  });
});

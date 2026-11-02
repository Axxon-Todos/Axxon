// Generates structured architecture change proposals from scoped graph context using the configured local model.
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { AgentPlanArtifact, AgentRun } from '@/lib/agents/domain';
import type { ArchitectureAgentContextPackage, ArchitectureChangeProposal, ArchitectureOperation } from './contracts';
import { validateArchitectureProposal } from './operations';

const componentSchema = z.object({
  id: z.string().min(1), type: z.string(), name: z.string().min(1), description: z.string().nullable(), parent_id: z.string().nullable(),
  responsibilities: z.array(z.string()), technologies: z.array(z.string()), requirements: z.array(z.string()), constraints: z.array(z.string()), metadata: z.record(z.unknown()),
});
const relationshipSchema = z.object({ id: z.string().min(1), source_component_id: z.string().min(1), target_component_id: z.string().min(1), type: z.string(), label: z.string().nullable(), metadata: z.record(z.unknown()) });
const operationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_component'), component: componentSchema.omit({ id: true }).extend({ id: z.string().min(1) }) }),
  z.object({ type: z.literal('update_component'), componentId: z.string().min(1), changes: z.record(z.unknown()) }),
  z.object({ type: z.literal('remove_component'), componentId: z.string().min(1) }),
  z.object({ type: z.literal('add_relationship'), relationship: relationshipSchema }),
  z.object({ type: z.literal('update_relationship'), relationshipId: z.string().min(1), changes: z.record(z.unknown()) }),
  z.object({ type: z.literal('remove_relationship'), relationshipId: z.string().min(1) }),
]);
const proposalSchema = z.object({ summary: z.string().min(1).max(1200), assumptions: z.array(z.string()).max(25), risks: z.array(z.string()).max(25), operations: z.array(operationSchema).min(1).max(40) });

function parseJson(content: string) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? content.slice(start, end + 1) : content) as unknown;
}

// Normalizes common model aliases while keeping the final proposal schema strict.
function normalizeOperations(value: unknown) {
  if (!Array.isArray(value)) return value;
  const aliases: Record<string, string> = {
    add_node: 'add_component', create_component: 'add_component', create_node: 'add_component',
    update_node: 'update_component', modify_component: 'update_component',
    remove_node: 'remove_component', delete_component: 'remove_component',
    connect: 'add_relationship', create_relationship: 'add_relationship', add_edge: 'add_relationship',
    update_edge: 'update_relationship', modify_relationship: 'update_relationship',
    disconnect: 'remove_relationship', delete_relationship: 'remove_relationship', remove_edge: 'remove_relationship',
  };
  const componentTypeAliases: Record<string, string> = { api_service: 'api', web_application: 'frontend', frontend: 'frontend', backend_service: 'service', data_store: 'database', postgres: 'database' };
  const relationshipTypeAliases: Record<string, string> = { dependency: 'depends_on', depends: 'depends_on', communicates_with: 'calls', stores_in: 'writes_to', reads: 'reads_from' };
  const knownComponents = new Map<string, string>();
  const normalizedOperations = value.map((entry) => {
    if (typeof entry === 'string') {
      const componentMatch = entry.match(/Create\s+(.+?)\s+component\s+ID\s+['"]([^'"]+)['"].*?type\s+['"]([^'"]+)['"]/i);
      if (componentMatch) {
        const [, name, id, rawType] = componentMatch;
        const normalizedType = componentTypeAliases[rawType.trim().toLowerCase().replaceAll(' ', '_')] || (rawType.toLowerCase().includes('backend') ? 'service' : rawType.toLowerCase().includes('frontend') ? 'application' : rawType.toLowerCase().replaceAll(' ', '_'));
        knownComponents.set(name.trim().toLowerCase(), id);
        return { type: 'add_component', component: { id, type: normalizedType, name: name.trim(), description: null, parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {} } };
      }
      const relationshipMatch = entry.match(/Create\s+Relationship\s+ID\s+['"]([^'"]+)['"].*?connecting\s+(.+?)\s+to\s+(.+?)(?:\s+with|\s+and|$)/i);
      if (relationshipMatch) {
        const [, id, sourceName, targetName] = relationshipMatch;
        const sourceId = knownComponents.get(sourceName.trim().toLowerCase()) || Array.from(knownComponents.entries()).find(([name]) => name.includes(sourceName.trim().toLowerCase()) || sourceName.trim().toLowerCase().includes(name))?.[1];
        const targetId = knownComponents.get(targetName.trim().toLowerCase()) || Array.from(knownComponents.entries()).find(([name]) => name.includes(targetName.trim().toLowerCase()) || targetName.trim().toLowerCase().includes(name))?.[1];
        const fallbackIds = Array.from(knownComponents.values());
        return { type: 'add_relationship', relationship: { id, source_component_id: sourceId || fallbackIds[0], target_component_id: targetId || fallbackIds[1], type: 'depends_on', label: null, metadata: {} } };
      }
      return entry;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    const operation = { ...(entry as Record<string, unknown>) };
    const rawType = typeof operation.type === 'string' ? operation.type.trim().toLowerCase().replaceAll(' ', '_') : '';
    if ((rawType === 'create' || rawType === 'add' || !rawType) && (operation.relationship || operation.targetRelationship) && typeof (operation.relationship || operation.targetRelationship) === 'object') {
      operation.type = 'add_relationship';
      operation.relationship = operation.relationship || operation.targetRelationship;
    } else if ((rawType === 'create' || rawType === 'add' || !rawType) && (operation.component || operation.targetComponent) && typeof (operation.component || operation.targetComponent) === 'object') {
      operation.type = 'add_component';
      operation.component = operation.component || operation.targetComponent;
    }
    else operation.type = aliases[rawType] || rawType;

    if (operation.type === 'add_component') {
      const component = { ...((operation.component || operation.node || {}) as Record<string, unknown>) };
      component.id = typeof component.id === 'string' && component.id.trim() ? component.id : randomUUID();
      const rawComponentType = typeof component.type === 'string' ? component.type.trim().toLowerCase().replaceAll(' ', '_') : 'service';
      component.type = componentTypeAliases[rawComponentType] || rawComponentType;
      component.parent_id = typeof component.parent_id === 'string' ? component.parent_id : null;
      component.description = typeof component.description === 'string' ? component.description : null;
      for (const key of ['responsibilities', 'technologies', 'requirements', 'constraints']) if (!Array.isArray(component[key])) component[key] = [];
      if (!component.metadata || typeof component.metadata !== 'object' || Array.isArray(component.metadata)) component.metadata = {};
      operation.component = component;
    }
    if (operation.type === 'add_relationship') {
      const relationship = { ...((operation.relationship || operation.edge || operation.targetRelationship || {}) as Record<string, unknown>) };
      relationship.id = typeof relationship.id === 'string' && relationship.id.trim() ? relationship.id : randomUUID();
      const rawRelationshipType = typeof relationship.type === 'string' ? relationship.type.trim().toLowerCase().replaceAll(' ', '_') : 'depends_on';
      relationship.type = relationshipTypeAliases[rawRelationshipType] || rawRelationshipType;
      const sourceComponentId = relationship.source_component_id || relationship.sourceComponentId || relationship.source || relationship.from;
      const targetComponentId = relationship.target_component_id || relationship.destinationComponentId || relationship.targetComponentId || relationship.target || relationship.to;
      relationship.source_component_id = sourceComponentId == null ? undefined : String(sourceComponentId);
      relationship.target_component_id = targetComponentId == null ? undefined : String(targetComponentId);
      relationship.label = typeof relationship.label === 'string' ? relationship.label : null;
      if (!relationship.metadata || typeof relationship.metadata !== 'object' || Array.isArray(relationship.metadata)) relationship.metadata = {};
      operation.relationship = relationship;
    }
    return operation;
  });
  return normalizedOperations.filter((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    return ['add_component', 'update_component', 'remove_component', 'add_relationship', 'update_relationship', 'remove_relationship'].includes(String((entry as Record<string, unknown>).type));
  });
}

// Supplies a conservative bootstrap graph when a local model returns only prose operations.
function buildBootstrapFallback(run: AgentRun, context: ArchitectureAgentContextPackage) {
  if (run.architectureIntent !== 'bootstrap' || context.graph.components.length > 0) return [];
  const frontendId = randomUUID();
  const apiId = randomUUID();
  const databaseId = randomUUID();
  return [
    { type: 'add_component', component: { id: frontendId, type: 'application', name: 'Frontend Application', description: `Client application for ${run.prompt.slice(0, 180)}`, parent_id: null, responsibilities: ['Present the user-facing workflow.'], technologies: [], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_component', component: { id: apiId, type: 'service', name: 'API Service', description: 'Owns application workflows and exposes validated interfaces.', parent_id: null, responsibilities: ['Handle application requests.'], technologies: [], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_component', component: { id: databaseId, type: 'database', name: 'PostgreSQL Database', description: 'Persists the application data owned by the system.', parent_id: null, responsibilities: ['Persist project data.'], technologies: ['PostgreSQL'], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: frontendId, target_component_id: apiId, type: 'calls', label: 'HTTP API', metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: apiId, target_component_id: databaseId, type: 'writes_to', label: 'Persistence', metadata: {} } },
  ];
}

function buildPrompt(run: AgentRun, context: ArchitectureAgentContextPackage) {
  return [
    'You are Axxon Architecture Agent. Return JSON only.',
    `Intent: ${run.architectureIntent || 'propose_change'}.`,
    'Produce a reviewable structured change proposal. Never describe mutations that are not represented in operations.',
    'Use stable existing IDs for updates/removals. Use unique IDs for new components and relationships.',
    'Do not remove or modify unrelated components. Respect fixed component and relationship types.',
    'For bootstrap, create the smallest useful architecture from the user request. For review, still return concrete operations only when a change is necessary.',
    `User request: ${run.prompt}`,
    `Requirements: ${JSON.stringify(context.requirements, null, 2)}`,
    `Reviewer feedback to address: ${JSON.stringify(context.reviewerFeedback, null, 2)}`,
    `Scoped context: ${JSON.stringify({ target: context.target, selectedComponent: context.selectedComponent, selectedRelationship: context.selectedRelationship, dependencyNeighborhood: context.dependencyNeighborhood, graph: context.graph, constraints: context.constraints }, null, 2)}`,
    'Required shape: {"summary":"...","assumptions":[],"risks":[],"operations":[...]}',
  ].join('\n\n');
}

export async function generateArchitectureProposalWithOllama(run: AgentRun, context: ArchitectureAgentContextPackage): Promise<ArchitectureChangeProposal> {
  const baseUrl = (process.env.AI_LOCAL_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const model = process.env.AI_LOCAL_MODEL || 'qwen3.5-4b-32k:latest';
  const response = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: false, format: 'json', think: false, messages: [{ role: 'system', content: buildPrompt(run, context) }] }) });
  if (!response.ok) throw new Error(`Architecture provider request failed with ${response.status}`);
  const body = await response.json() as { message?: { content?: string } };
  const generated = parseJson(body.message?.content?.trim() || '') as Record<string, unknown>;
  const normalizedOperations = normalizeOperations(generated.operations);
  const fallbackOperations = buildBootstrapFallback(run, context);
  let parsed;
  try {
    const operations = Array.isArray(normalizedOperations) && normalizedOperations.length > 0 ? normalizedOperations : fallbackOperations;
    parsed = proposalSchema.parse({ ...generated, operations });
  } catch (error) {
    if (fallbackOperations.length === 0) throw error;
    parsed = proposalSchema.parse({ ...generated, operations: fallbackOperations });
  }
  const proposal = { intent: (run.architectureIntent || 'propose_change') as ArchitectureChangeProposal['intent'], baseRevisionId: context.revisionId, operations: parsed.operations as ArchitectureOperation[], summary: parsed.summary, assumptions: parsed.assumptions, risks: parsed.risks };
  validateArchitectureProposal(context.graph, proposal);
  return proposal;
}

export function architectureProposalToPlanArtifact(proposal: ArchitectureChangeProposal): AgentPlanArtifact {
  return {
    summary: proposal.summary,
    objective: proposal.summary,
    scope: { inScope: proposal.operations.map((operation) => operation.type), outOfScope: ['Direct canonical architecture mutation'] },
    requirements: ['All operations must pass architecture graph validation before application.'],
    assumptions: proposal.assumptions,
    constraints: ['The proposal targets the exact base revision recorded in the artifact.'],
    affectedAreas: proposal.operations.map((operation) => operation.type),
    technicalDecisions: [],
    implementationPhases: [{ id: 'architecture-change', title: 'Apply reviewed architecture change', summary: 'Apply the validated operation set after approval.', tasks: [{ id: 'apply-change-set', title: 'Apply architecture change set', description: 'Validate and apply the proposed graph operations to a new revision.', type: 'architecture', priority: 'high', dependencyIds: [], acceptanceCriteria: ['The operation set passes deterministic graph validation.'] }] }],
    risks: proposal.risks,
    successCriteria: ['The proposed change is reviewable and does not mutate canonical state before approval.'],
    openQuestions: [],
    notes: ['This artifact contains structured architecture operations for the review UI.'],
    architectureProposal: proposal,
  };
}

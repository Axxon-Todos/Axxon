// Generates structured architecture change proposals from scoped graph context using the configured local model.
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { AgentPlanArtifact, AgentRun } from '@/lib/agents/domain';
import type { ArchitectureAgentContextPackage, ArchitectureChangeProposal, ArchitectureOperation } from './contracts';
import type { ArchitectureComponent } from '@/lib/types/architectureTypes';
import { applyArchitectureOperations, validateArchitectureProposal } from './operations';
import { evaluateArchitectureBootstrapQuality, withStandardArchitectureBootstrapAssumptions } from './bootstrapQuality';

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
const proposalSchema = z.object({ summary: z.string().min(1).max(1200), assumptions: z.array(z.string()).max(25), risks: z.array(z.string()).max(25), technicalDecisions: z.array(z.object({ area: z.string().min(1), choice: z.string().min(1), rationale: z.string().min(1) })).max(25).default([]), operations: z.array(operationSchema).min(1).max(40) });

const NOTE_PRIMARY_KEYS = new Set(['text', 'title', 'description', 'label']);
const NOTE_DETAIL_KEYS = new Set(['rationale', 'reason', 'impact', 'mitigation', 'detail', 'category', 'likelihood']);

function parseJson(content: string) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? content.slice(start, end + 1) : content) as unknown;
}

// Converts structured provider notes into concise schema-compatible strings without weakening operation validation.
function normalizeArchitectureNotes(value: unknown) {
  if (!Array.isArray(value)) return value;

  return value.map((entry) => {
    if (typeof entry === 'string') return entry.trim();
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;

    const primary: string[] = [];
    const details: string[] = [];
    for (const [key, rawValue] of Object.entries(entry as Record<string, unknown>)) {
      if (typeof rawValue !== 'string' && typeof rawValue !== 'number' && typeof rawValue !== 'boolean') continue;
      const text = String(rawValue).replace(/\s+/g, ' ').trim();
      if (!text) continue;
      if (NOTE_PRIMARY_KEYS.has(key)) primary.push(text);
      else if (NOTE_DETAIL_KEYS.has(key)) details.push(`${key[0].toUpperCase()}${key.slice(1)}: ${text}`);
    }

    const normalized = [...primary, ...details].join(' — ').trim();
    return normalized ? normalized.slice(0, 240).trim() : entry;
  });
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

const bootstrapStandardAssumptions = [
  'Standard assumption: begin with a modular monolith and split deployable services only when scale or ownership requires it.',
  'Standard assumption: use HTTPS for service traffic, managed PostgreSQL for transactional data, and encrypted storage with backups.',
  'Standard assumption: use a durable queue for asynchronous ingestion and retry transient failures with idempotent handlers.',
  'Standard assumption: deploy separate development, staging, and production environments with least-privilege access.',
  'Standard assumption: emit structured logs, metrics, traces, health checks, and actionable alerts for every production boundary.',
];

const bootstrapTechnicalDecisions = [
  { area: 'application shape', choice: 'Modular monolith', rationale: 'Keeps the initial system easy to change while preserving clear ownership boundaries.' },
  { area: 'transactional data', choice: 'PostgreSQL', rationale: 'Provides durable relational storage, transactions, migrations, and mature recovery tooling.' },
  { area: 'ingestion', choice: 'Durable queue with idempotent workers', rationale: 'Separates request latency from asynchronous processing and makes retries safe.' },
  { area: 'runtime', choice: 'Containerized environments', rationale: 'Makes development, staging, and production deployments repeatable.' },
  { area: 'security', choice: 'OAuth 2.0, TLS, and least privilege', rationale: 'Protects identity, transport, and resource access using standard controls.' },
  { area: 'observability', choice: 'OpenTelemetry with metrics and alerts', rationale: 'Provides consistent traces, logs, and operational signals across boundaries.' },
];

type BootstrapQualityArea = 'application' | 'data' | 'ingestion' | 'infrastructure' | 'security' | 'observability';

const bootstrapQualityAreaLabels: Record<BootstrapQualityArea, string> = {
  application: 'application',
  data: 'data',
  ingestion: 'ingestion',
  infrastructure: 'infrastructure',
  security: 'security',
  observability: 'observability',
};

// Maps a component to the bootstrap concern it explicitly covers.
function getBootstrapQualityAreas(component: Pick<ArchitectureComponent, 'type' | 'name'>) {
  const value = `${component.type} ${component.name}`.toLowerCase();
  const areas = new Set<BootstrapQualityArea>();
  if (['application', 'frontend', 'service', 'backend_domain', 'module', 'api', 'gateway'].includes(component.type) || /app|frontend|api|service|workflow|client/.test(value)) areas.add('application');
  if (['database', 'storage', 'cache'].includes(component.type) || /data|database|storage|cache|postgres|sql/.test(value)) areas.add('data');
  if (['queue', 'event_bus', 'integration'].includes(component.type) || /ingest|queue|event|import|stream|worker/.test(value)) areas.add('ingestion');
  if (['cloud_resource', 'network_boundary', 'deployment_environment'].includes(component.type) || /infra|runtime|network|deploy|environment|cluster|cloud/.test(value)) areas.add('infrastructure');
  if (['security_control', 'trust_boundary'].includes(component.type) || /security|identity|auth|permission|encryption|trust/.test(value)) areas.add('security');
  if (['monitoring', 'observability'].includes(component.type) || /observability|monitor|metric|logging|trac|alert|telemetry/.test(value)) areas.add('observability');
  return areas;
}

// Enforces the minimum useful shape of a new architecture before it reaches review.
export function validateArchitectureBootstrapQuality(graph: ArchitectureAgentContextPackage['graph'], assumptions: string[], technicalDecisions: ArchitectureChangeProposal['technicalDecisions'] = []) {
  const coveredAreas = new Set<BootstrapQualityArea>();
  for (const component of graph.components) {
    for (const area of getBootstrapQualityAreas(component)) coveredAreas.add(area);
    if (component.technologies.length === 0) throw new Error(`Bootstrap component "${component.name}" requires a technology decision`);
    if (component.responsibilities.length === 0) throw new Error(`Bootstrap component "${component.name}" requires responsibilities`);
  }

  const missingAreas = (Object.keys(bootstrapQualityAreaLabels) as BootstrapQualityArea[]).filter((area) => !coveredAreas.has(area));
  if (missingAreas.length > 0) throw new Error(`Bootstrap architecture is missing coverage: ${missingAreas.map((area) => bootstrapQualityAreaLabels[area]).join(', ')}`);
  if (graph.components.length < 6) throw new Error('Bootstrap architecture requires at least six components covering the major system concerns');
  if (graph.relationships.length < graph.components.length - 1) throw new Error('Bootstrap architecture requires relationships between its major components');
  const connected = new Set([graph.components[0]?.id]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const relationship of graph.relationships) {
      if (connected.has(relationship.source_component_id) && !connected.has(relationship.target_component_id)) { connected.add(relationship.target_component_id); expanded = true; }
      if (connected.has(relationship.target_component_id) && !connected.has(relationship.source_component_id)) { connected.add(relationship.source_component_id); expanded = true; }
    }
  }
  if (connected.size !== graph.components.length) throw new Error('Bootstrap architecture contains disconnected components');
  if (technicalDecisions.length < 4) throw new Error('Bootstrap architecture requires at least four explicit technology decisions');
  const standardAssumptions = assumptions.filter((assumption) => /^standard assumption:/i.test(assumption.trim()));
  if (standardAssumptions.length < 3) throw new Error('Bootstrap architecture requires at least three explicit standard assumptions');
}

// Supplies a deterministic, reviewable bootstrap graph when model output is absent or too generic.
function buildBootstrapFallback(run: AgentRun, context: ArchitectureAgentContextPackage) {
  if (run.architectureIntent !== 'bootstrap') return [];
  const existingByType = new Map(context.graph.components.map((component) => [component.type, component]));
  const ids = Object.fromEntries(['application', 'api', 'data', 'ingestion', 'runtime', 'security', 'observability', 'rawData', 'network'].map((key) => [key, randomUUID()]));
  const updates = context.graph.components.flatMap((component) => {
    const technologies = component.technologies.length > 0 ? component.technologies : component.type === 'database' ? ['PostgreSQL'] : component.type === 'application' ? ['TypeScript', 'React'] : ['TypeScript', 'Node.js'];
    const responsibilities = component.responsibilities.length > 0 ? component.responsibilities : [`Own the ${component.name.toLowerCase()} responsibility and expose a clear operational boundary.`];
    return [{ type: 'update_component', componentId: component.id, changes: { technologies, responsibilities } }];
  });
  const applicationId = existingByType.get('application')?.id || ids.application;
  const apiId = existingByType.get('service')?.id || existingByType.get('api')?.id || ids.api;
  const dataId = existingByType.get('database')?.id || ids.data;
  const additions = [
    { type: 'add_component', component: { id: ids.application, type: 'application', name: 'User Application', description: `User-facing application for ${run.prompt.slice(0, 180)}`, parent_id: null, responsibilities: ['Present the primary user workflow and collect validated input.'], technologies: ['TypeScript', 'React'], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_component', component: { id: ids.api, type: 'service', name: 'Application API', description: 'Owns application workflows and exposes validated interfaces.', parent_id: null, responsibilities: ['Authenticate requests and coordinate domain workflows.'], technologies: ['TypeScript', 'Node.js'], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_component', component: { id: ids.data, type: 'database', name: 'Transactional Data Store', description: 'Persists the application data owned by the system.', parent_id: null, responsibilities: ['Own durable records, migrations, indexes, and recovery.'], technologies: ['PostgreSQL'], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_component', component: { id: ids.ingestion, type: 'queue', name: 'Ingestion Queue', description: 'Buffers imports and asynchronous work before processing.', parent_id: null, responsibilities: ['Accept durable work, support retries, and preserve processing order where needed.'], technologies: ['Redis Streams'], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_component', component: { id: `${ids.ingestion}-worker`, type: 'service', name: 'Ingestion Worker', description: 'Processes queued imports outside the request path.', parent_id: null, responsibilities: ['Consume queued work, validate payloads, and persist idempotent results.'], technologies: ['Node.js', 'BullMQ'], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_component', component: { id: ids.runtime, type: 'deployment_environment', name: 'Production Runtime', description: 'Provides isolated, repeatable deployment environments.', parent_id: null, responsibilities: ['Run the application with configuration, capacity, health checks, and controlled releases.'], technologies: ['Docker', 'Kubernetes'], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_component', component: { id: ids.security, type: 'security_control', name: 'Identity and Security Controls', description: 'Protects access, secrets, data, and service boundaries.', parent_id: null, responsibilities: ['Enforce authentication, authorization, encryption, secret handling, and audit policy.'], technologies: ['OAuth 2.0', 'TLS'], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_component', component: { id: ids.observability, type: 'observability', name: 'Observability Stack', description: 'Makes production behavior measurable and diagnosable.', parent_id: null, responsibilities: ['Collect structured logs, metrics, traces, health signals, and alerts.'], technologies: ['OpenTelemetry', 'Prometheus'], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_component', component: { id: ids.rawData, type: 'storage', name: 'Raw Ingestion Storage', description: 'Keeps immutable source payloads for replay and audit.', parent_id: null, responsibilities: ['Store source payloads with lifecycle and encryption controls.'], technologies: ['S3-compatible object storage'], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_component', component: { id: ids.network, type: 'network_boundary', name: 'Private Network Boundary', description: 'Separates public ingress from private services and data stores.', parent_id: null, responsibilities: ['Restrict service and data traffic to approved paths.'], technologies: ['VPC', 'TLS'], requirements: [], constraints: [], metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: ids.application, target_component_id: ids.api, type: 'calls', label: 'HTTPS API', metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: ids.api, target_component_id: ids.data, type: 'writes_to', label: 'Transactional persistence', metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: ids.api, target_component_id: ids.ingestion, type: 'publishes_to', label: 'Asynchronous ingestion work', metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: ids.ingestion, target_component_id: `${ids.ingestion}-worker`, type: 'subscribes_to', label: 'Queued work', metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: `${ids.ingestion}-worker`, target_component_id: ids.data, type: 'writes_to', label: 'Imported records', metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: ids.api, target_component_id: ids.security, type: 'secured_by', label: 'Identity and policy', metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: ids.api, target_component_id: ids.runtime, type: 'deployed_on', label: 'Production deployment', metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: ids.api, target_component_id: ids.observability, type: 'monitored_by', label: 'Telemetry and alerts', metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: ids.ingestion, target_component_id: ids.rawData, type: 'writes_to', label: 'Raw payload archive', metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: ids.api, target_component_id: ids.network, type: 'secured_by', label: 'Private service boundary', metadata: {} } },
    { type: 'add_relationship', relationship: { id: randomUUID(), source_component_id: dataId, target_component_id: ids.network, type: 'secured_by', label: 'Private data boundary', metadata: {} } },
  ];
  const filteredAdditions = additions.filter((operation) => {
    if (operation.type !== 'add_component') return true;
    const component = operation.component as { id: string; type: string };
    if (context.graph.components.some((entry) => entry.id === component.id)) return false;
    if (component.type === 'application' && existingByType.has('application')) return false;
    if (component.type === 'service' && existingByType.has('service')) return false;
    if (component.type === 'database' && existingByType.has('database')) return false;
    return true;
  });
  const remapped = [...updates, ...filteredAdditions] as Array<Record<string, unknown>>;
  return remapped.map((operation) => {
    if (operation.type !== 'add_relationship' || !operation.relationship || typeof operation.relationship !== 'object') return operation;
    const relationship = operation.relationship as Record<string, unknown>;
    return { ...operation, relationship: { ...relationship, source_component_id: relationship.source_component_id === ids.application ? applicationId : relationship.source_component_id === ids.api ? apiId : relationship.source_component_id, target_component_id: relationship.target_component_id === ids.application ? applicationId : relationship.target_component_id === ids.api ? apiId : relationship.target_component_id === ids.data ? dataId : relationship.target_component_id } };
  });
}

export function buildArchitecturePrompt(run: AgentRun, context: ArchitectureAgentContextPackage) {
  return [
    'You are Axxon Architecture Agent. Return JSON only.',
    `Intent: ${run.architectureIntent || 'propose_change'}.`,
    'Produce a reviewable structured change proposal. Never describe mutations that are not represented in operations.',
    'Use stable existing IDs for updates/removals. Use unique IDs for new components and relationships.',
    'Do not remove or modify unrelated components. Respect fixed component and relationship types.',
    'For bootstrap, create a coherent architecture rather than a generic three-node graph. It must cover application, data, ingestion, infrastructure, security, and observability with named components.',
    'Every bootstrap component must include non-empty responsibilities and concrete technology decisions. Add relationships that explain request flow, persistence, ingestion, deployment, security, and monitoring.',
    'Include at least four technicalDecisions with area, choice, and rationale fields.',
    `Every bootstrap response must include at least three assumptions prefixed exactly with "Standard assumption:". State practical defaults explicitly when the user did not specify them: modularity, transport/data protection, asynchronous work, environments/access, and observability.`,
    `User request: ${run.prompt}`,
    `Requirements: ${JSON.stringify(context.requirements, null, 2)}`,
    `Reviewer feedback to address: ${JSON.stringify(context.reviewerFeedback, null, 2)}`,
    `Scoped context: ${JSON.stringify({ target: context.target, selectedComponent: context.selectedComponent, selectedRelationship: context.selectedRelationship, dependencyNeighborhood: context.dependencyNeighborhood, graph: context.graph, constraints: context.constraints }, null, 2)}`,
    'Required shape: {"summary":"...","assumptions":[],"technicalDecisions":[{"area":"...","choice":"...","rationale":"..."}],"risks":[],"operations":[...]}',
  ].join('\n\n');
}

export async function generateArchitectureProposalWithOllama(run: AgentRun, context: ArchitectureAgentContextPackage): Promise<ArchitectureChangeProposal> {
  const baseUrl = (process.env.AI_LOCAL_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const model = process.env.AI_LOCAL_MODEL || 'qwen3.5-4b-32k:latest';
  const response = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: false, format: 'json', think: false, messages: [{ role: 'system', content: buildArchitecturePrompt(run, context) }] }) });
  if (!response.ok) throw new Error(`Architecture provider request failed with ${response.status}`);
  const body = await response.json() as { message?: { content?: string } };
  const generated = parseJson(body.message?.content?.trim() || '') as Record<string, unknown>;
  const normalizedOperations = normalizeOperations(generated.operations);
  const normalizedAssumptions = normalizeArchitectureNotes(generated.assumptions);
  const normalizedRisks = normalizeArchitectureNotes(generated.risks);
  const fallbackOperations = buildBootstrapFallback(run, context);
  let parsed;
  try {
    const operations = Array.isArray(normalizedOperations) && normalizedOperations.length > 0 ? normalizedOperations : fallbackOperations;
    parsed = proposalSchema.parse({ ...generated, assumptions: normalizedAssumptions, risks: normalizedRisks, operations });
  } catch (error) {
    if (fallbackOperations.length === 0) throw error;
    parsed = proposalSchema.parse({ ...generated, assumptions: normalizedAssumptions || bootstrapStandardAssumptions, risks: normalizedRisks || [], operations: fallbackOperations });
  }
  let proposal: ArchitectureChangeProposal = { intent: (run.architectureIntent || 'propose_change') as ArchitectureChangeProposal['intent'], baseRevisionId: context.revisionId, operations: parsed.operations as ArchitectureOperation[], summary: parsed.summary, assumptions: parsed.assumptions, risks: parsed.risks, technicalDecisions: parsed.technicalDecisions };
  const isBootstrap = run.architectureIntent === 'bootstrap';
  if (isBootstrap) {
    proposal = { ...proposal, assumptions: withStandardArchitectureBootstrapAssumptions(proposal.assumptions) };
    try {
      const generatedGraph = applyArchitectureOperations(context.graph, proposal.operations, context.projectId);
      validateArchitectureBootstrapQuality(generatedGraph, proposal.assumptions, proposal.technicalDecisions);
      const quality = evaluateArchitectureBootstrapQuality(context.graph, proposal);
      if (!quality.passed) throw new Error(quality.issues.join('; '));
    } catch {
      const fallbackOperations = buildBootstrapFallback(run, context);
      proposal = { ...proposal, operations: fallbackOperations as ArchitectureOperation[], assumptions: bootstrapStandardAssumptions, technicalDecisions: bootstrapTechnicalDecisions };
    }
  }
  validateArchitectureProposal(context.graph, proposal, context.projectId);
  if (isBootstrap) validateArchitectureBootstrapQuality(applyArchitectureOperations(context.graph, proposal.operations, context.projectId), proposal.assumptions, proposal.technicalDecisions);
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
    technicalDecisions: proposal.technicalDecisions.map((decision) => ({ ...decision, source: 'assumed' as const })),
    implementationPhases: [{ id: 'architecture-change', title: 'Apply reviewed architecture change', summary: 'Apply the validated operation set after approval.', tasks: [{ id: 'apply-change-set', title: 'Apply architecture change set', description: 'Validate and apply the proposed graph operations to a new revision.', type: 'architecture', priority: 'high', dependencyIds: [], acceptanceCriteria: ['The operation set passes deterministic graph validation.'] }] }],
    risks: proposal.risks,
    successCriteria: ['The proposed change is reviewable and does not mutate canonical state before approval.'],
    openQuestions: [],
    notes: ['This artifact contains structured architecture operations for the review UI.'],
    architectureProposal: proposal,
  };
}

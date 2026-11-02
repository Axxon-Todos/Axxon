// Defines the canonical architecture graph contracts shared by persistence, APIs, UI, and agents.
export const architectureComponentTypes = [
  'application', 'frontend', 'service', 'backend_domain', 'module', 'api', 'gateway',
  'database', 'storage', 'cache', 'queue', 'event_bus', 'external_service', 'integration',
  'cloud_resource', 'network_boundary', 'deployment_environment', 'security_control',
  'trust_boundary', 'monitoring', 'observability',
] as const;

export type ArchitectureComponentType = (typeof architectureComponentTypes)[number];

export const architectureRelationshipTypes = [
  'depends_on', 'calls', 'reads_from', 'writes_to', 'publishes_to',
  'subscribes_to', 'authenticates_through', 'deployed_on', 'monitored_by', 'secured_by',
] as const;

export type ArchitectureRelationshipType = (typeof architectureRelationshipTypes)[number];

export const architectureViewKeys = [
  'overview', 'frontend', 'backend', 'api_auth', 'data', 'infrastructure', 'security', 'observability',
] as const;
export type ArchitectureViewKey = (typeof architectureViewKeys)[number];

export type ArchitectureComponentCatalogEntry = {
  type: ArchitectureComponentType;
  label: string;
  category: 'application' | 'backend' | 'data' | 'infrastructure' | 'security' | 'operations' | 'external';
  description: string;
  defaultViews: ArchitectureViewKey[];
  suggestedRelationships: ArchitectureRelationshipType[];
};

export type ArchitectureViewDefinition = {
  key: ArchitectureViewKey;
  name: string;
  description: string;
};

export const architectureViewDefinitions: ArchitectureViewDefinition[] = [
  { key: 'overview', name: 'System Overview', description: 'Major applications, services, data stores, and deployment boundaries.' },
  { key: 'frontend', name: 'Frontend', description: 'Client applications, UI modules, and delivery paths.' },
  { key: 'backend', name: 'Backend', description: 'Server-side services, domains, modules, and processing.' },
  { key: 'api_auth', name: 'API and Authentication', description: 'APIs, gateways, identity, sessions, and authorization.' },
  { key: 'data', name: 'Data and Persistence', description: 'Databases, storage, caches, ownership, and data movement.' },
  { key: 'infrastructure', name: 'Infrastructure and Deployment', description: 'Runtime resources, environments, ingress, and network boundaries.' },
  { key: 'security', name: 'Security', description: 'Trust boundaries, controls, identity, and protected dependencies.' },
  { key: 'observability', name: 'DevOps and Observability', description: 'Monitoring, delivery, logging, metrics, and operational dependencies.' },
];

export const architectureComponentCatalog: ArchitectureComponentCatalogEntry[] = [
  { type: 'application', label: 'Application', category: 'application', description: 'A user-facing or standalone software application.', defaultViews: ['overview', 'frontend'], suggestedRelationships: ['calls', 'authenticates_through', 'deployed_on'] },
  { type: 'frontend', label: 'Frontend / UI', category: 'application', description: 'A browser, mobile, or desktop client.', defaultViews: ['overview', 'frontend'], suggestedRelationships: ['calls', 'authenticates_through', 'deployed_on'] },
  { type: 'service', label: 'Backend Service', category: 'backend', description: 'A deployable service that owns business behavior.', defaultViews: ['overview', 'backend'], suggestedRelationships: ['calls', 'reads_from', 'writes_to', 'publishes_to'] },
  { type: 'backend_domain', label: 'Backend Domain', category: 'backend', description: 'A bounded business capability or domain boundary.', defaultViews: ['overview', 'backend'], suggestedRelationships: ['depends_on', 'calls', 'publishes_to'] },
  { type: 'module', label: 'Module', category: 'backend', description: 'A cohesive implementation module inside a larger component.', defaultViews: ['backend'], suggestedRelationships: ['depends_on', 'calls'] },
  { type: 'api', label: 'API', category: 'backend', description: 'A public or internal interface contract.', defaultViews: ['overview', 'backend', 'api_auth'], suggestedRelationships: ['calls', 'authenticates_through', 'secured_by'] },
  { type: 'gateway', label: 'API Gateway', category: 'backend', description: 'An ingress or routing boundary for API traffic.', defaultViews: ['overview', 'api_auth', 'infrastructure', 'security'], suggestedRelationships: ['calls', 'authenticates_through', 'secured_by', 'deployed_on'] },
  { type: 'database', label: 'Database', category: 'data', description: 'A structured persistent data store.', defaultViews: ['overview', 'data', 'security'], suggestedRelationships: ['reads_from', 'writes_to', 'secured_by', 'deployed_on'] },
  { type: 'storage', label: 'Object / File Storage', category: 'data', description: 'Durable blobs, files, or object storage.', defaultViews: ['data', 'infrastructure', 'security'], suggestedRelationships: ['reads_from', 'writes_to', 'secured_by', 'deployed_on'] },
  { type: 'cache', label: 'Cache', category: 'data', description: 'Fast, derived, or temporary data storage.', defaultViews: ['backend', 'data', 'infrastructure'], suggestedRelationships: ['reads_from', 'writes_to', 'deployed_on'] },
  { type: 'queue', label: 'Queue', category: 'data', description: 'A work queue for asynchronous processing.', defaultViews: ['backend', 'data', 'infrastructure'], suggestedRelationships: ['publishes_to', 'subscribes_to', 'deployed_on'] },
  { type: 'event_bus', label: 'Event Bus', category: 'data', description: 'Shared event delivery infrastructure.', defaultViews: ['backend', 'data', 'infrastructure'], suggestedRelationships: ['publishes_to', 'subscribes_to', 'deployed_on'] },
  { type: 'external_service', label: 'External Service', category: 'external', description: 'A system outside the project boundary.', defaultViews: ['overview', 'api_auth', 'infrastructure', 'security'], suggestedRelationships: ['calls', 'authenticates_through', 'secured_by'] },
  { type: 'integration', label: 'Integration', category: 'external', description: 'A connector or integration boundary.', defaultViews: ['overview', 'api_auth', 'backend'], suggestedRelationships: ['calls', 'publishes_to', 'subscribes_to'] },
  { type: 'cloud_resource', label: 'Cloud Resource', category: 'infrastructure', description: 'A managed or provisioned runtime resource.', defaultViews: ['overview', 'infrastructure', 'security'], suggestedRelationships: ['deployed_on', 'secured_by', 'monitored_by'] },
  { type: 'network_boundary', label: 'Network Boundary', category: 'infrastructure', description: 'A network, ingress, or isolation boundary.', defaultViews: ['infrastructure', 'security'], suggestedRelationships: ['secured_by', 'deployed_on'] },
  { type: 'deployment_environment', label: 'Deployment Environment', category: 'infrastructure', description: 'A development, staging, or production environment.', defaultViews: ['overview', 'infrastructure', 'observability'], suggestedRelationships: ['deployed_on', 'monitored_by'] },
  { type: 'security_control', label: 'Security Control', category: 'security', description: 'A control that protects data, access, or execution.', defaultViews: ['security', 'api_auth', 'data', 'infrastructure'], suggestedRelationships: ['secured_by', 'monitored_by'] },
  { type: 'trust_boundary', label: 'Trust Boundary', category: 'security', description: 'A boundary where trust or permissions change.', defaultViews: ['security', 'infrastructure'], suggestedRelationships: ['secured_by', 'authenticates_through'] },
  { type: 'monitoring', label: 'Monitoring', category: 'operations', description: 'Metrics, logs, dashboards, or alerts.', defaultViews: ['observability', 'infrastructure'], suggestedRelationships: ['monitored_by'] },
  { type: 'observability', label: 'Observability', category: 'operations', description: 'A tracing, logging, or operational visibility component.', defaultViews: ['observability', 'infrastructure'], suggestedRelationships: ['monitored_by', 'deployed_on'] },
];

export type ArchitectureComponent = {
  id: string;
  project_id: number;
  type: ArchitectureComponentType;
  name: string;
  description: string | null;
  parent_id: string | null;
  responsibilities: string[];
  technologies: string[];
  requirements: string[];
  constraints: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ArchitectureRelationship = {
  id: string;
  project_id: number;
  source_component_id: string;
  target_component_id: string;
  type: ArchitectureRelationshipType;
  label: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ArchitectureView = {
  id: number;
  project_id: number;
  key: ArchitectureViewKey;
  name: string;
  description: string;
  filter_json: Record<string, unknown>;
  nodes: ArchitectureViewNode[];
};

export type ArchitectureViewNode = {
  component_id: string;
  position_x: number;
  position_y: number;
  hidden: boolean;
  width?: number;
  height?: number;
};

export type ArchitectureGraph = {
  components: ArchitectureComponent[];
  relationships: ArchitectureRelationship[];
  views: ArchitectureView[];
};

export type ArchitectureDraftInput = {
  base_revision_id: number;
  components: Array<Omit<ArchitectureComponent, 'project_id' | 'created_at' | 'updated_at'>>;
  relationships: Array<Omit<ArchitectureRelationship, 'project_id' | 'created_at' | 'updated_at'>>;
  views: ArchitectureView[];
};

export type ArchitectureRevision = {
  id: number;
  project_id: number;
  version: number;
  parent_revision_id: number | null;
  created_by: number | null;
  snapshot_json: ArchitectureGraph;
  summary: string | null;
  created_at: string;
};

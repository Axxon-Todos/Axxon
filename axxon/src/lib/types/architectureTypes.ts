// Defines the canonical architecture graph contracts shared by persistence, APIs, UI, and agents.
export const architectureComponentTypes = [
  'application', 'service', 'module', 'api', 'database', 'cache', 'queue',
  'external_service', 'cloud_resource', 'security_control', 'monitoring',
] as const;

export type ArchitectureComponentType = (typeof architectureComponentTypes)[number];

export const architectureRelationshipTypes = [
  'depends_on', 'calls', 'reads_from', 'writes_to', 'publishes_to',
  'subscribes_to', 'authenticates_through', 'deployed_on', 'monitored_by', 'secured_by',
] as const;

export type ArchitectureRelationshipType = (typeof architectureRelationshipTypes)[number];

export const architectureViewKeys = ['overview', 'backend', 'api_auth', 'data', 'infrastructure'] as const;
export type ArchitectureViewKey = (typeof architectureViewKeys)[number];

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

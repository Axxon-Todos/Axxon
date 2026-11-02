// Defines architecture-agent intents, scoped context, and reviewable graph operations.
import type { ArchitectureComponent, ArchitectureGraph, ArchitectureRelationship, ArchitectureViewKey } from '@/lib/types/architectureTypes';

export const architectureAgentIntents = ['bootstrap', 'propose_change', 'review_architecture'] as const;
export type ArchitectureAgentIntent = (typeof architectureAgentIntents)[number];

export type ArchitectureAgentTarget = {
  componentId?: string;
  relationshipId?: string;
  viewKey?: ArchitectureViewKey;
  revisionId?: number;
  commentThreadId?: number;
};

export type ArchitectureAgentContextPackage = {
  projectId: number;
  revisionId: number;
  graph: ArchitectureGraph;
  target: ArchitectureAgentTarget | null;
  selectedComponent: ArchitectureComponent | null;
  selectedRelationship: ArchitectureRelationship | null;
  dependencyNeighborhood: {
    components: ArchitectureComponent[];
    relationships: ArchitectureRelationship[];
  };
  constraints: string[];
  requirements: ArchitectureRequirementContext[];
  reviewerFeedback: string[];
};

export type ArchitectureRequirementContext = {
  key: string;
  title: string;
  statement: string;
  category: string;
  priority: string;
  status: string;
  source: string;
  rationale: string | null;
  blocking: boolean;
};

export type ArchitectureOperation =
  | { type: 'add_component'; component: Omit<ArchitectureComponent, 'project_id' | 'created_at' | 'updated_at'> }
  | { type: 'update_component'; componentId: string; changes: Partial<Pick<ArchitectureComponent, 'type' | 'name' | 'description' | 'parent_id' | 'responsibilities' | 'technologies' | 'requirements' | 'constraints' | 'metadata'>> }
  | { type: 'remove_component'; componentId: string }
  | { type: 'add_relationship'; relationship: Omit<ArchitectureRelationship, 'project_id' | 'created_at' | 'updated_at'> }
  | { type: 'update_relationship'; relationshipId: string; changes: Partial<Pick<ArchitectureRelationship, 'source_component_id' | 'target_component_id' | 'type' | 'label' | 'metadata'>> }
  | { type: 'remove_relationship'; relationshipId: string };

export type ArchitectureChangeProposal = {
  intent: ArchitectureAgentIntent;
  baseRevisionId: number;
  operations: ArchitectureOperation[];
  summary: string;
  assumptions: string[];
  risks: string[];
  technicalDecisions: Array<{ area: string; choice: string; rationale: string }>;
};

export type ArchitectureSemanticDiff = {
  added: Array<{ entityType: 'component' | 'relationship'; id: string; name?: string; type?: string }>;
  modified: Array<{ entityType: 'component' | 'relationship'; id: string; fields: string[] }>;
  removed: Array<{ entityType: 'component' | 'relationship'; id: string; name?: string; type?: string }>;
  affected: Array<{ entityType: 'component' | 'relationship'; id: string; reason: string }>;
};

export type ArchitectureImpactFinding = {
  severity: 'info' | 'warning' | 'blocking';
  entityType: 'component' | 'relationship' | 'requirement';
  entityId: string;
  message: string;
};

// Builds the smallest useful architecture context package for a project-agent request.
import { Architecture } from '@/lib/models/architecture';
import { ArchitectureRequirements } from '@/lib/models/architectureRequirements';
import type { ArchitectureAgentContextPackage, ArchitectureAgentTarget } from './contracts';

export async function buildArchitectureContext(
  projectId: number,
  revisionId: number,
  target: ArchitectureAgentTarget | null = null
): Promise<ArchitectureAgentContextPackage> {
  const graph = await Architecture.getGraph(projectId);
  const selectedComponent = target?.componentId ? graph.components.find((component) => component.id === target.componentId) || null : null;
  const selectedRelationship = target?.relationshipId ? graph.relationships.find((relationship) => relationship.id === target.relationshipId) || null : null;
  const componentIds = new Set<string>();
  if (selectedComponent) componentIds.add(selectedComponent.id);
  if (selectedRelationship) {
    componentIds.add(selectedRelationship.source_component_id);
    componentIds.add(selectedRelationship.target_component_id);
  }
  for (const relationship of graph.relationships) {
    if (componentIds.has(relationship.source_component_id) || componentIds.has(relationship.target_component_id)) {
      componentIds.add(relationship.source_component_id);
      componentIds.add(relationship.target_component_id);
    }
  }
  return {
    projectId,
    revisionId,
    graph,
    target,
    selectedComponent,
    selectedRelationship,
    dependencyNeighborhood: {
      components: graph.components.filter((component) => componentIds.has(component.id)),
      relationships: graph.relationships.filter((relationship) => componentIds.has(relationship.source_component_id) || componentIds.has(relationship.target_component_id)),
    },
    constraints: selectedComponent?.constraints || [],
    requirements: (await ArchitectureRequirements.list(projectId)).map((requirement) => ({
      key: requirement.key,
      title: requirement.title,
      statement: requirement.statement,
      category: requirement.category,
      priority: requirement.priority,
      status: requirement.status,
      source: requirement.source,
      rationale: requirement.rationale,
      blocking: requirement.blocking,
    })),
    reviewerFeedback: [],
  };
}

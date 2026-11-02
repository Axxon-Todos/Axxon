// Projects the complete architecture change set in memory for review without mutating canonical state.
'use client';

import type { ArchitectureOperation } from '@/lib/agents/architecture/contracts';
import { applyArchitectureOperations } from '@/lib/agents/architecture/operations';
import type { ArchitectureComponent, ArchitectureGraph, ArchitectureRelationship } from '@/lib/types/architectureTypes';

type ArchitectureProposalPreviewProps = {
  graph: ArchitectureGraph;
  operations: ArchitectureOperation[];
  proposedGraph?: ArchitectureGraph;
};

export type ArchitectureProposalTopology = {
  graph: ArchitectureGraph;
  components: ArchitectureComponent[];
  relationships: ArchitectureRelationship[];
  componentCount: number;
  relationshipCount: number;
};

// Applies every proposal operation to a cloned graph and returns exact topology counts for the preview.
export function buildArchitectureProposalTopology(graph: ArchitectureGraph, operations: ArchitectureOperation[], persistedGraph?: ArchitectureGraph): ArchitectureProposalTopology {
  const nextGraph = persistedGraph || applyArchitectureOperations(graph, operations, graph.components[0]?.project_id);
  return {
    graph: nextGraph,
    components: nextGraph.components,
    relationships: nextGraph.relationships,
    componentCount: nextGraph.components.length,
    relationshipCount: nextGraph.relationships.length,
  };
}

// Resolves relationship endpoints against the persisted proposed component set.
function componentName(components: ArchitectureComponent[], id: string) {
  return components.find((component) => component.id === id)?.name || id;
}

// Renders the projected graph topology; the saved architecture remains unchanged until approval.
export function ArchitectureProposalPreview({ graph, operations, proposedGraph }: ArchitectureProposalPreviewProps) {
  let topology: ArchitectureProposalTopology;
  try {
    topology = buildArchitectureProposalTopology(graph, operations, proposedGraph);
  } catch (error) {
    return <div className="mt-5 rounded-2xl border border-[var(--app-danger)]/40 bg-[var(--app-panel-soft)] p-4" aria-label="Proposed architecture preview">
      <p className="app-kicker">Preview unavailable</p>
      <p className="mt-2 text-sm app-error-text">{error instanceof Error ? error.message : 'The proposed topology could not be validated.'}</p>
    </div>;
  }

  const { components, relationships } = topology;
  return <div className="mt-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4" aria-label="Proposed architecture preview">
    <div className="flex items-center justify-between gap-3"><div><p className="app-kicker">Before approval</p><h3 className="mt-1 text-sm font-semibold">Projected topology</h3></div><span className="text-xs app-text-muted">{topology.componentCount} components · {topology.relationshipCount} connections</span></div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <section aria-label="Projected components"><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] app-text-muted">Components</p><div className="mt-2 space-y-1.5">{components.length ? components.map((component) => <div key={component.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-2.5 py-2 text-xs"><span className="truncate font-medium">{component.name}</span><span className="shrink-0 app-text-muted">{component.type.replaceAll('_', ' ')}</span></div>) : <p className="text-xs app-text-muted">No components remain.</p>}</div></section>
      <section aria-label="Projected relationships"><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] app-text-muted">Connections</p><div className="mt-2 space-y-1.5">{relationships.length ? relationships.map((relationship) => <div key={relationship.id} className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-2.5 py-2 text-xs"><div className="flex items-center gap-2"><span className="truncate font-medium">{componentName(components, relationship.source_component_id)}</span><span className="app-text-muted">→</span><span className="truncate font-medium">{componentName(components, relationship.target_component_id)}</span></div><p className="mt-1 app-text-muted">{relationship.label || relationship.type.replaceAll('_', ' ')}</p></div>) : <p className="text-xs app-text-muted">No connections remain.</p>}</div></section>
    </div>
    <p className="mt-3 text-xs leading-5 app-text-muted">This is a review preview. The saved architecture remains unchanged until an authorized reviewer approves the proposal.</p>
  </div>;
}

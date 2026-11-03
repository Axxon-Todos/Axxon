// Projects the complete architecture change set in memory for review without mutating canonical state.
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ArchitectureOperation } from '@/lib/agents/architecture/contracts';
import { applyArchitectureOperations } from '@/lib/agents/architecture/operations';
import type { ArchitectureComponent, ArchitectureGraph, ArchitectureRelationship } from '@/lib/types/architectureTypes';
import { Background, MarkerType, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react';

type ArchitectureProposalPreviewProps = {
  graph: ArchitectureGraph;
  operations: ArchitectureOperation[];
  proposedGraph?: ArchitectureGraph;
  mode?: 'panel' | 'canvas';
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

// Builds a read-only graph projection for the ghost canvas without changing canonical React Query state.
function buildGhostGraph(current: ArchitectureGraph, proposed: ArchitectureGraph) {
  const layout = proposed.views.find((view) => view.key === 'overview') || proposed.views[0];
  const positions = new Map((layout?.nodes || []).map((node) => [node.component_id, node]));
  const currentIds = new Set(current.components.map((component) => component.id));
  const nodes: Node[] = proposed.components.map((component, index) => {
    const position = positions.get(component.id);
    return {
      id: component.id,
      position: position ? { x: position.position_x, y: position.position_y } : { x: 48 + (index % 3) * 230, y: 48 + Math.floor(index / 3) * 130 },
      data: { label: component.name },
      style: { width: 178, minHeight: 64, borderRadius: 14, padding: 12, background: 'var(--app-panel)', color: 'var(--app-foreground)', border: `1px ${currentIds.has(component.id) ? 'solid' : 'dashed'} ${currentIds.has(component.id) ? 'var(--app-border-strong)' : 'var(--app-foreground)'}`, boxShadow: currentIds.has(component.id) ? 'none' : '0 0 0 2px color-mix(in srgb, var(--app-foreground) 18%, transparent)' },
    };
  });
  const edges: Edge[] = proposed.relationships.filter((relationship) => proposed.components.some((component) => component.id === relationship.source_component_id) && proposed.components.some((component) => component.id === relationship.target_component_id)).map((relationship) => ({ id: relationship.id, source: relationship.source_component_id, target: relationship.target_component_id, label: relationship.label || relationship.type.replaceAll('_', ' '), animated: relationship.type !== 'depends_on', markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--app-muted)' }, style: { stroke: 'var(--app-muted)', strokeWidth: 1.5 }, labelStyle: { fill: 'var(--app-muted)', fontSize: 10 }, labelBgStyle: { fill: 'var(--app-panel-soft)', fillOpacity: 0.9 } }));
  return { nodes, edges };
}

// Renders the projected graph topology; the saved architecture remains unchanged until approval.
export function ArchitectureProposalPreview({ graph, operations, proposedGraph, mode = 'canvas' }: ArchitectureProposalPreviewProps) {
  const [canvasHost, setCanvasHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (mode === 'canvas') setCanvasHost(document.querySelector<HTMLElement>('.architecture-flow'));
  }, [mode]);
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
  let ghost: { nodes: Node[]; edges: Edge[] };
  try {
    ghost = buildGhostGraph(graph, topology.graph);
  } catch (error) {
    return <div className="mt-5 rounded-2xl border border-[var(--app-danger)]/40 bg-[var(--app-panel-soft)] p-4" aria-label="Proposed architecture preview">
      <p className="app-kicker">Preview unavailable</p>
      <p className="mt-2 text-sm app-error-text">{error instanceof Error ? error.message : 'The proposed graph could not be rendered.'}</p>
    </div>;
  }
  if (mode === 'canvas') {
    if (!canvasHost) return null;
    return createPortal(<div className="absolute inset-0 z-10 bg-[var(--app-panel)]" aria-label="Proposed architecture canvas">
      <ReactFlow nodes={ghost.nodes} edges={ghost.edges} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} zoomOnDoubleClick={false} fitView fitViewOptions={{ padding: 0.2 }} proOptions={{ hideAttribution: true }}>
        <Background color="var(--app-border)" gap={24} />
        <MiniMap pannable={false} zoomable={false} />
      </ReactFlow>
      <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-3 py-2 shadow-lg">
        <p className="app-kicker">Before approval</p>
        <p className="mt-1 text-sm font-semibold">Ghost architecture · not applied</p>
        <p className="mt-1 text-xs app-text-muted">Dashed nodes are new in this proposal.</p>
      </div>
    </div>, canvasHost);
  }

  return <div className="mt-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4" aria-label="Proposed architecture preview">
    <div className="flex items-center justify-between gap-3"><div><p className="app-kicker">Before approval</p><h3 className="mt-1 text-sm font-semibold">Projected topology</h3></div><span className="text-xs app-text-muted">{topology.componentCount} components · {topology.relationshipCount} connections</span></div>
    <div className="relative mt-4 h-[22rem] overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)]" aria-label="Ghost graph preview"><ReactFlow nodes={ghost.nodes} edges={ghost.edges} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} zoomOnDoubleClick={false} fitView fitViewOptions={{ padding: 0.2 }} proOptions={{ hideAttribution: true }}><Background color="var(--app-border)" gap={20} /><MiniMap pannable={false} zoomable={false} /></ReactFlow><span className="pointer-events-none absolute left-3 top-3 rounded-full border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] app-text-muted">Ghost preview · not applied</span></div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <section aria-label="Projected components"><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] app-text-muted">Components</p><div className="mt-2 space-y-1.5">{components.length ? components.map((component) => <div key={component.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-2.5 py-2 text-xs"><span className="truncate font-medium">{component.name}</span><span className="shrink-0 app-text-muted">{component.type.replaceAll('_', ' ')}</span></div>) : <p className="text-xs app-text-muted">No components remain.</p>}</div></section>
      <section aria-label="Projected relationships"><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] app-text-muted">Connections</p><div className="mt-2 space-y-1.5">{relationships.length ? relationships.map((relationship) => <div key={relationship.id} className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-2.5 py-2 text-xs"><div className="flex items-center gap-2"><span className="truncate font-medium">{componentName(components, relationship.source_component_id)}</span><span className="app-text-muted">→</span><span className="truncate font-medium">{componentName(components, relationship.target_component_id)}</span></div><p className="mt-1 app-text-muted">{relationship.label || relationship.type.replaceAll('_', ' ')}</p></div>) : <p className="text-xs app-text-muted">No connections remain.</p>}</div></section>
    </div>
    <p className="mt-3 text-xs leading-5 app-text-muted">This is a review preview. The saved architecture remains unchanged until an authorized reviewer approves the proposal.</p>
  </div>;
}

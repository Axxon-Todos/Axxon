// Shows a lightweight topology preview for an unapproved architecture proposal.
'use client';

import type { ArchitectureComponent, ArchitectureGraph } from '@/lib/types/architectureTypes';

type ArchitectureProposalPreviewProps = {
  graph: ArchitectureGraph;
  operations: Array<Record<string, unknown>>;
};

function proposedComponents(graph: ArchitectureGraph, operations: Array<Record<string, unknown>>) {
  const components = new Map(graph.components.map((component) => [component.id, component]));
  for (const operation of operations) {
    if (operation.type === 'remove_component' && typeof operation.componentId === 'string') components.delete(operation.componentId);
    if (operation.type === 'add_component' && operation.component && typeof operation.component === 'object') {
      const component = operation.component as Partial<ArchitectureComponent>;
      if (typeof component.id === 'string' && typeof component.name === 'string') components.set(component.id, { ...component, id: component.id, name: component.name } as ArchitectureComponent);
    }
    if (operation.type === 'update_component' && typeof operation.componentId === 'string' && operation.changes && typeof operation.changes === 'object') {
      const current = components.get(operation.componentId);
      if (current) components.set(operation.componentId, { ...current, ...(operation.changes as Partial<ArchitectureComponent>) });
    }
  }
  return [...components.values()];
}

// Renders the projected node set without implying that the canonical graph changed.
export function ArchitectureProposalPreview({ graph, operations }: ArchitectureProposalPreviewProps) {
  const components = proposedComponents(graph, operations);
  const removedCount = operations.filter((operation) => operation.type === 'remove_component' || operation.type === 'remove_relationship').length;
  const addedCount = operations.filter((operation) => operation.type === 'add_component' || operation.type === 'add_relationship').length;
  return <div className="mt-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4" aria-label="Proposed architecture preview">
    <div className="flex items-center justify-between gap-3"><div><p className="app-kicker">Before approval</p><h3 className="mt-1 text-sm font-semibold">Projected topology</h3></div><span className="text-xs app-text-muted">{components.length} components · {graph.relationships.length + addedCount - removedCount} connections</span></div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {components.slice(0, 12).map((component, index) => <span key={component.id} className="inline-flex items-center gap-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-2.5 py-2 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-[var(--app-foreground)]" />{component.name}{index < Math.min(components.length, 12) - 1 ? <span className="app-text-muted">→</span> : null}</span>)}
      {components.length > 12 ? <span className="text-xs app-text-muted">+{components.length - 12} more</span> : null}
    </div>
    <p className="mt-3 text-xs leading-5 app-text-muted">This is a review preview. The saved architecture remains unchanged until an authorized reviewer approves the proposal.</p>
  </div>;
}

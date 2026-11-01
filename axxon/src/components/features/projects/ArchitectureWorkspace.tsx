// Renders the interactive architecture canvas, focused views, inspector, and revision actions.
'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node, type OnNodesChange, applyNodeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Check, GitBranch, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Surface from '@/components/ui/Surface';
import { commitProjectArchitecture, fetchProjectArchitecture, saveProjectArchitecture } from '@/lib/api/projects/getProjectArchitecture';
import type { ArchitectureComponent, ArchitectureDraftInput, ArchitectureViewKey } from '@/lib/types/architectureTypes';
import { cn } from '@/lib/utils/cn';

const viewLabels: Record<ArchitectureViewKey, string> = {
  overview: 'Overview', backend: 'Backend', api_auth: 'API / Auth', data: 'Data', infrastructure: 'Infrastructure',
};

function buildNodes(components: ArchitectureComponent[], viewKey: ArchitectureViewKey, viewNodes: { component_id: string; position_x: number; position_y: number; hidden: boolean }[]) {
  const positions = new Map(viewNodes.map((node) => [node.component_id, node]));
  return components.map((component, index) => {
    const position = positions.get(component.id) || { position_x: 80 + (index % 4) * 220, position_y: 80 + Math.floor(index / 4) * 150, hidden: false };
    return { id: component.id, position: { x: position.position_x, y: position.position_y }, hidden: position.hidden, data: { label: component.name, type: component.type }, type: 'default' } satisfies Node;
  });
}

export default function ArchitectureWorkspace({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<ArchitectureViewKey>('overview');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({ queryKey: ['project-architecture', organizationId, projectId], queryFn: () => fetchProjectArchitecture(organizationId, projectId) });
  const graph = data?.graph;
  const activeViewData = graph?.views.find((view) => view.key === activeView) || graph?.views[0];
  const nodes = useMemo(() => graph && activeViewData ? buildNodes(graph.components, activeView, activeViewData.nodes) : [], [activeView, activeViewData, graph]);
  const edges = useMemo<Edge[]>(() => (graph?.relationships || []).map((relationship) => ({ id: relationship.id, source: relationship.source_component_id, target: relationship.target_component_id, label: relationship.type.replaceAll('_', ' '), animated: false })), [graph]);
  const selected = graph?.components.find((component) => component.id === selectedId) || null;
  const [draftNodes, setDraftNodes] = useState<Node[] | null>(null);
  const displayedNodes = draftNodes || nodes;

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!graph || !activeViewData) throw new Error('Architecture is not loaded');
      const nextViews = graph.views.map((view) => view.key === activeView ? { ...view, nodes: displayedNodes.map((node) => ({ component_id: node.id, position_x: node.position.x, position_y: node.position.y, hidden: Boolean(node.hidden) })) } : view);
      const payload: ArchitectureDraftInput = { base_revision_id: data?.revisions[0]?.id || 0, components: graph.components, relationships: graph.relationships, views: nextViews };
      return saveProjectArchitecture(organizationId, projectId, payload);
    },
    onSuccess: (nextGraph) => { queryClient.setQueryData(['project-architecture', organizationId, projectId], (current: typeof data) => current ? { ...current, graph: nextGraph } : current); setDraftNodes(null); },
  });
  const commitMutation = useMutation({ mutationFn: () => commitProjectArchitecture(organizationId, projectId, 'Committed architecture draft.'), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-architecture', organizationId, projectId] }) });

  const onNodesChange: OnNodesChange = (changes) => setDraftNodes((current) => applyNodeChanges(changes, current || nodes));
  const addComponent = () => {
    if (!graph) return;
    const component: ArchitectureComponent = { id: crypto.randomUUID(), project_id: Number(projectId), type: 'service', name: `Service ${graph.components.length + 1}`, description: 'Define this component responsibility.', parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    queryClient.setQueryData(['project-architecture', organizationId, projectId], (current: typeof data) => current ? { ...current, graph: { ...current.graph, components: [...current.graph.components, component] } } : current);
    setSelectedId(component.id);
  };
  const removeSelected = () => {
    if (!selectedId || !graph) return;
    queryClient.setQueryData(['project-architecture', organizationId, projectId], (current: typeof data) => current ? { ...current, graph: { ...current.graph, components: current.graph.components.filter((component) => component.id !== selectedId), relationships: current.graph.relationships.filter((edge) => edge.source_component_id !== selectedId && edge.target_component_id !== selectedId) } } : current);
    setSelectedId(null);
  };

  if (isLoading) return <div className="app-page"><Surface variant="strong" className="rounded-[2rem] p-8">Loading architecture workspace...</Surface></div>;
  if (isError || !data || !graph) return <div className="app-page"><Surface variant="strong" className="rounded-[2rem] p-8 text-sm app-error-text">Failed to load architecture workspace.</Surface></div>;

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] min-w-0 flex-col gap-4">
      <Surface variant="strong" className="rounded-[1.5rem] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="app-kicker">Architecture project</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{data.project.name}</h1><p className="mt-1 text-sm app-text-muted">{data.project.description || 'Design the system from requirements to implementation.'}</p></div>
          <div className="flex flex-wrap gap-2"><Badge><GitBranch className="h-3.5 w-3.5" /> Revision {data.revisions[0]?.version || 1}</Badge><Button size="sm" onClick={addComponent}><Plus className="h-4 w-4" /> Component</Button><Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}><Save className="h-4 w-4" /> {saveMutation.isPending ? 'Saving' : 'Save draft'}</Button><Button size="sm" variant="primary" onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending}><Check className="h-4 w-4" /> Commit revision</Button></div>
        </div>
      </Surface>
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Surface variant="strong" className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-[1.5rem]">
          <div className="flex flex-wrap gap-2 border-b border-[var(--app-border)] p-3">{(Object.keys(viewLabels) as ArchitectureViewKey[]).map((key) => <button key={key} type="button" onClick={() => { setActiveView(key); setDraftNodes(null); }} className={cn('rounded-xl px-3 py-2 text-sm transition-colors', activeView === key ? 'bg-[var(--app-foreground)] text-[var(--app-panel)]' : 'app-text-muted hover:bg-[var(--app-panel-soft)]')}>{viewLabels[key]}</button>)}<span className="ml-auto flex items-center gap-2 text-xs app-text-muted"><Sparkles className="h-3.5 w-3.5" /> Agent workspace next</span></div>
          <div className="min-h-0 flex-1"><ReactFlow nodes={displayedNodes} edges={edges} onNodesChange={onNodesChange} onNodeClick={(_, node) => setSelectedId(node.id)} fitView proOptions={{ hideAttribution: true }}><Background color="var(--app-border)" gap={24} /><Controls /><MiniMap /></ReactFlow></div>
        </Surface>
        <Surface variant="strong" className="rounded-[1.5rem] p-5">
          <div className="flex items-center justify-between"><div><p className="app-kicker">Component inspector</p><h2 className="mt-2 text-lg font-semibold">{selected?.name || 'Select a component'}</h2></div>{selected ? <Button size="icon" variant="danger" onClick={removeSelected} aria-label="Remove component"><Trash2 className="h-4 w-4" /></Button> : null}</div>
          {selected ? <div className="mt-6 space-y-5 text-sm"><div><p className="app-text-muted">Type</p><p className="mt-1 font-medium">{selected.type.replaceAll('_', ' ')}</p></div><div><p className="app-text-muted">Purpose</p><p className="mt-1 leading-6">{selected.description || 'No purpose defined yet.'}</p></div><div><p className="app-text-muted">Responsibilities</p><p className="mt-1 leading-6">{selected.responsibilities.length ? selected.responsibilities.join(', ') : 'Add responsibilities during refinement.'}</p></div><div className="border-t border-[var(--app-border)] pt-4"><p className="app-kicker">Dependencies</p><p className="mt-2 app-text-muted">{graph.relationships.filter((edge) => edge.source_component_id === selected.id || edge.target_component_id === selected.id).length} connected relationships</p></div></div> : <p className="mt-6 text-sm leading-6 app-text-muted">Select a node to inspect its responsibilities, technologies, constraints, and connected relationships.</p>}
        </Surface>
      </div>
    </div>
  );
}

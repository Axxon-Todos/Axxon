// Renders the interactive architecture canvas, focused views, inspector, and revision actions.
'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Background, BaseEdge, ConnectionLineType, Controls, EdgeLabelRenderer, Handle, MarkerType, MiniMap, NodeResizer, Position, ReactFlow, getSmoothStepPath, type Connection, type Edge, type EdgeProps, type Node, type NodeProps, type OnNodesChange, applyNodeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Check, GitBranch, History, Loader2, Plus, Save, Search, Send, Sparkles, Trash2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Surface from '@/components/ui/Surface';
import { ArchitectureDiscoveryPanel } from '@/components/features/projects/ArchitectureDiscoveryPanel';
import { ArchitectureProposalPreview } from '@/components/features/projects/ArchitectureProposalPreview';
import { commitProjectArchitecture, fetchProjectArchitecture, saveProjectArchitecture } from '@/lib/api/projects/getProjectArchitecture';
import { approveProjectAgentRun, createProjectAgentRun, fetchProjectAgentRuns, requestProjectAgentChanges } from '@/lib/api/projects/agentRuns';
import { ArchitectureCollaborationPanel } from '@/components/features/projects/collaboration/ArchitectureCollaborationPanel';
import { useSocket } from '@/hooks/useSocket';
import { useArchitectureCollaboration } from '@/hooks/useArchitectureCollaboration';
import { useProjectRealtime } from '@/hooks/useProjectRealtime';
import { useProjectPresence } from '@/hooks/useProjectPresence';
import { useProjectSelection } from '@/hooks/useProjectSelection';
import { useProjectCollaborationState } from '@/hooks/useProjectCollaborationState';
import type { AgentRun } from '@/lib/types/agentTypes';
import { architectureComponentCatalog, architectureComponentTypes, type ArchitectureComponent, type ArchitectureComponentType, type ArchitectureDraftInput, type ArchitectureRelationshipType, type ArchitectureViewKey } from '@/lib/types/architectureTypes';
import { getArchitectureDescendantIds, getConnectionPositions, inferArchitectureRelationshipType, projectArchitectureGraph } from '@/lib/utils/architectureGraph';
import { cn } from '@/lib/utils/cn';

const viewLabels: Record<ArchitectureViewKey, string> = {
  overview: 'Overview', frontend: 'Frontend', backend: 'Backend', api_auth: 'API / Auth', data: 'Data', infrastructure: 'Infrastructure', security: 'Security', observability: 'Observability',
};

const componentTypeLabels: Record<ArchitectureComponentType, string> = Object.fromEntries(architectureComponentCatalog.map((entry) => [entry.type, entry.label])) as Record<ArchitectureComponentType, string>;

type WorkspaceRailTab = 'inspect' | 'agent' | 'review' | 'collaboration' | 'history';
type ArchitectureNodeData = { label: string; type: string; parentId: string | null; childCount: number; collapsed: boolean; editing?: boolean; context?: boolean; collaborators?: number[]; onRename?: (name: string) => void; onToggleCollapse?: () => void };
type ArchitectureEdgeData = { label: string; relationshipType: string };
type ArchitectureEdge = Edge<ArchitectureEdgeData, 'dataFlow'>;

function buildNodes(components: ArchitectureComponent[], viewNodes: { component_id: string; position_x: number; position_y: number; hidden: boolean; width?: number; height?: number }[], contextIds: Set<string>, collapsedIds: Set<string>, collaboratorsByComponent: Map<string, number[]>, editingNodeId: string | null, onRename: (id: string, name: string) => void, onToggleCollapse: (id: string) => void, newNodeId: string | null, newNodePosition: { x: number; y: number }): Node<ArchitectureNodeData>[] {
  const positions = new Map(viewNodes.map((node) => [node.component_id, node]));
  return components.map((component, index) => {
    const position = positions.get(component.id) || (component.id === newNodeId ? { position_x: newNodePosition.x, position_y: newNodePosition.y, hidden: false, width: undefined, height: undefined } : { position_x: 80 + (index % 4) * 220, position_y: 80 + Math.floor(index / 4) * 150, hidden: false, width: undefined, height: undefined });
    const childCount = components.filter((candidate) => candidate.parent_id === component.id).length;
    const hiddenByAncestor = [...collapsedIds].some((collapsedId) => getArchitectureDescendantIds(components, collapsedId).has(component.id));
    return { id: component.id, position: { x: position.position_x, y: position.position_y }, width: position.width, height: position.height, hidden: position.hidden || hiddenByAncestor, data: { label: component.name, type: component.type, parentId: component.parent_id, childCount, collapsed: collapsedIds.has(component.id), collaborators: collaboratorsByComponent.get(component.id) || [], context: contextIds.has(component.id), editing: editingNodeId === component.id, onRename: (name: string) => onRename(component.id, name), onToggleCollapse: () => onToggleCollapse(component.id) } satisfies ArchitectureNodeData, type: 'architecture' } satisfies Node<ArchitectureNodeData>;
  });
}

// Provides readable, resizable architecture nodes without forcing users into a fixed card width.
function ArchitectureNode({ data, selected }: NodeProps<Node<ArchitectureNodeData>>) {
  const handleClass = '!border-[var(--app-panel)] !bg-[var(--app-foreground)] architecture-node-handle';
  return <div className={cn('architecture-node', data.context && 'architecture-node-context')}><NodeResizer isVisible={selected} minWidth={150} minHeight={64} handleClassName="architecture-node-resizer" />{([['top', Position.Top], ['right', Position.Right], ['bottom', Position.Bottom], ['left', Position.Left]] as const).map(([id, position]) => <span key={`handles-${id}`}><Handle id={`${id}-target`} type="target" position={position} className={handleClass} /><Handle id={`${id}-source`} type="source" position={position} className={handleClass} /></span>)}{data.collaborators?.length ? <div className="architecture-node-collaborators" aria-label={`${data.collaborators.length} collaborators viewing this component`}>{data.collaborators.map((userId) => <span key={userId} title={`User ${userId}`}>{String(userId).slice(-2)}</span>)}</div> : null}<div className="flex items-start justify-between gap-2"><p className="architecture-node-type">{data.type.replaceAll('_', ' ')}{data.context ? <span className="architecture-node-context-label">Context</span> : null}</p>{data.childCount ? <button type="button" aria-label={`${data.collapsed ? 'Expand' : 'Collapse'} ${data.label} subsystem`} aria-expanded={!data.collapsed} onClick={(event) => { event.stopPropagation(); data.onToggleCollapse?.(); }} className="architecture-node-collapse">{data.collapsed ? '+' : '−'} {data.childCount}</button> : null}</div>{data.editing ? <input autoFocus value={data.label} onChange={(event) => data.onRename?.(event.target.value)} onBlur={() => data.onRename?.(data.label.trim() || data.label)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} onClick={(event) => event.stopPropagation()} className="architecture-node-name-input" aria-label="Rename component" /> : <p className="architecture-node-label">{data.label}</p>}{data.parentId ? <p className="architecture-node-parent">Subsystem member</p> : null}</div>;
}

function flowSpeed(relationshipType: string) {
  if (relationshipType === 'reads_from' || relationshipType === 'writes_to' || relationshipType === 'publishes_to') return 3.2;
  if (relationshipType === 'calls' || relationshipType === 'subscribes_to') return 4.2;
  return 6.5;
}

// Converts the geometry decision into the concrete React Flow handle IDs used by each node.
function handleId(position: string, kind: 'source' | 'target') {
  return `${position}-${kind}`;
}

// Renders relationships as directional system traffic instead of static connector lines.
function DataFlowEdge({ id, sourceX, sourceY, targetX, targetY, targetPosition, sourcePosition, data, selected }: EdgeProps<ArchitectureEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 18, offset: 22 });
  const relationshipType = data?.relationshipType || 'depends_on';
  const speed = flowSpeed(relationshipType);
  const motionPath = path.replaceAll('"', '&quot;');
  return <>
    <BaseEdge id={id} path={path} markerEnd={MarkerType.ArrowClosed} className={cn('architecture-flow-edge', selected && 'architecture-flow-edge-selected')} />
    <path d={path} fill="none" stroke="transparent" strokeWidth="12" className="react-flow__edge-interaction" />
    {relationshipType !== 'depends_on' ? <>
      <circle r="3" className="architecture-flow-packet architecture-flow-packet-primary"><animateMotion dur={`${speed}s`} repeatCount="indefinite" path={motionPath} /></circle>
      <circle r="2" className="architecture-flow-packet architecture-flow-packet-secondary"><animateMotion dur={`${speed}s`} begin={`-${speed / 2}s`} repeatCount="indefinite" path={motionPath} /></circle>
    </> : null}
    <EdgeLabelRenderer><div className="architecture-flow-edge-label" style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}>{data?.label}</div></EdgeLabelRenderer>
  </>;
}

function operationLabel(operation: Record<string, unknown>, graph: { components: ArchitectureComponent[]; relationships: { id: string; label: string | null; source_component_id: string; target_component_id: string }[] }) {
  const type = String(operation.type || '').replaceAll('_', ' ');
  if (type.includes('component')) return `${type}: ${String(operation.componentId || (operation.component as Record<string, unknown> | undefined)?.name || 'component')}`;
  const relationship = graph.relationships.find((entry) => entry.id === operation.relationshipId);
  return `${type}: ${String(operation.relationshipId || (operation.relationship as Record<string, unknown> | undefined)?.label || relationship?.label || 'relationship')}`;
}

// Renders the changed fields so reviewers can inspect the proposed semantic delta before approving it.
function operationDetails(operation: Record<string, unknown>, graph: { components: ArchitectureComponent[]; relationships: { id: string; source_component_id: string; target_component_id: string; label: string | null }[] }) {
  const changes = operation.changes as Record<string, unknown> | undefined;
  if (changes && Object.keys(changes).length) {
    const current = operation.componentId ? graph.components.find((entry) => entry.id === operation.componentId) : graph.relationships.find((entry) => entry.id === operation.relationshipId);
    return Object.entries(changes).map(([key, value]) => `${key}: ${current ? JSON.stringify((current as unknown as Record<string, unknown>)[key]) : '—'} → ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' · ');
  }
  const entity = (operation.component || operation.relationship) as Record<string, unknown> | undefined;
  if (entity) return Object.entries(entity).filter(([key]) => !['id', 'metadata'].includes(key)).slice(0, 3).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' · ');
  return 'No additional fields';
}

export default function ArchitectureWorkspace({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const queryClient = useQueryClient();
  const { socketRef, projectReady } = useSocket(null, projectId);
  useProjectRealtime(organizationId, projectId, socketRef, projectReady);
  const collaboration = useArchitectureCollaboration(organizationId, projectId, socketRef, projectReady);
  const collaborators = useProjectCollaborationState(socketRef, projectReady);
  const [activeView, setActiveView] = useState<ArchitectureViewKey>('overview');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [agentPrompt, setAgentPrompt] = useState('Design an initial architecture for this project.');
  const [reviewRunId, setReviewRunId] = useState<number | null>(null);
  const [changeFeedback, setChangeFeedback] = useState('');
  const [railTab, setRailTab] = useState<WorkspaceRailTab>('inspect');
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [nodePaletteOpen, setNodePaletteOpen] = useState(false);
  const [nodePaletteQuery, setNodePaletteQuery] = useState('');
  const [nodeCreationPosition, setNodeCreationPosition] = useState({ x: 120, y: 120 });
  const [newNodeId, setNewNodeId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [pendingRelationshipId, setPendingRelationshipId] = useState<string | null>(null);
  const [quickActionsPosition, setQuickActionsPosition] = useState({ left: 16, top: 16 });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError } = useQuery({ queryKey: ['project-architecture', organizationId, projectId], queryFn: () => fetchProjectArchitecture(organizationId, projectId) });
  const graph = data?.graph;
  useProjectPresence(socketRef, projectReady, { componentId: selectedId, relationshipId: selectedRelationshipId, viewKey: activeView, status: 'active' });
  useProjectSelection(socketRef, projectReady, { componentId: selectedId, relationshipId: selectedRelationshipId, viewKey: activeView });
  const runsQuery = useQuery({
    queryKey: ['project-agent-runs', organizationId, projectId],
    queryFn: () => fetchProjectAgentRuns(organizationId, projectId),
    refetchInterval: (query) => query.state.data?.some((run) => ['queued', 'preparing', 'planning'].includes(run.state)) ? 2000 : false,
  });
  const [draftNodes, setDraftNodes] = useState<Node<ArchitectureNodeData>[] | null>(null);
  const activeViewData = graph?.views.find((view) => view.key === activeView) || graph?.views[0];
  const projection = useMemo(() => graph ? projectArchitectureGraph(graph, activeView) : null, [activeView, graph]);
  const collaboratorsByComponent = useMemo(() => {
    const grouped = new Map<string, number[]>();
    collaborators.filter((collaborator) => collaborator.status === 'active' && collaborator.viewKey === activeView && collaborator.componentId).forEach((collaborator) => {
      const componentId = collaborator.componentId as string;
      grouped.set(componentId, [...(grouped.get(componentId) || []), collaborator.userId]);
    });
    return grouped;
  }, [activeView, collaborators]);
  const renameComponent = useCallback((id: string, name: string) => {
    queryClient.setQueryData(['project-architecture', organizationId, projectId], (current: typeof data) => current ? { ...current, graph: { ...current.graph, components: current.graph.components.map((component) => component.id === id ? { ...component, name, updated_at: new Date().toISOString() } : component) } } : current);
    setDraftDirty(true);
    setDraftNodes((current) => current ? current.map((node) => node.id === id ? { ...node, data: { ...node.data, label: name } } : node) : current);
  }, [organizationId, projectId, queryClient]);
  const toggleCollapsed = useCallback((id: string) => setCollapsedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }), []);
  const nodes = useMemo(() => graph && activeViewData && projection ? buildNodes(projection.components, activeViewData.nodes, projection.contextIds, collapsedIds, collaboratorsByComponent, editingNodeId, renameComponent, toggleCollapsed, newNodeId, nodeCreationPosition) : [], [activeViewData, collapsedIds, collaboratorsByComponent, editingNodeId, graph, newNodeId, nodeCreationPosition, projection, renameComponent, toggleCollapsed]);
  const edges = useMemo<ArchitectureEdge[]>(() => {
    if (!graph || !projection) return [];
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    return projection.relationships.filter((relationship) => !nodeMap.get(relationship.source_component_id)?.hidden && !nodeMap.get(relationship.target_component_id)?.hidden).map((relationship) => {
      const source = nodeMap.get(relationship.source_component_id);
      const target = nodeMap.get(relationship.target_component_id);
      const positions = source && target ? getConnectionPositions(source.position, target.position) : { sourcePosition: Position.Right, targetPosition: Position.Left };
      const metadata = relationship.metadata || {};
      return { id: relationship.id, source: relationship.source_component_id, target: relationship.target_component_id, selected: selectedRelationshipId === relationship.id, sourceHandle: typeof metadata.sourceHandle === 'string' ? metadata.sourceHandle : handleId(positions.sourcePosition, 'source'), targetHandle: typeof metadata.targetHandle === 'string' ? metadata.targetHandle : handleId(positions.targetPosition, 'target'), sourcePosition: positions.sourcePosition, targetPosition: positions.targetPosition, type: 'dataFlow', data: { label: relationship.type.replaceAll('_', ' '), relationshipType: relationship.type } };
    });
  }, [graph, nodes, projection, selectedRelationshipId]);
  const selected = graph?.components.find((component) => component.id === selectedId) || null;
  const pendingRelationship = graph?.relationships.find((relationship) => relationship.id === pendingRelationshipId) || null;
  const filteredCatalog = architectureComponentCatalog.filter((entry) => `${entry.label} ${entry.description} ${entry.category}`.toLowerCase().includes(nodePaletteQuery.toLowerCase().trim()));
  const displayedNodes = draftNodes || nodes;
  const nodeTypes = useMemo(() => ({ architecture: ArchitectureNode }), []);
  const edgeTypes = useMemo(() => ({ dataFlow: DataFlowEdge }), []);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!graph || !activeViewData) throw new Error('Architecture is not loaded');
      const nextViews = graph.views.map((view) => view.key === activeView ? { ...view, nodes: [...view.nodes.filter((viewNode) => !displayedNodes.some((node) => node.id === viewNode.component_id)), ...displayedNodes.map((node) => ({ component_id: node.id, position_x: node.position.x, position_y: node.position.y, hidden: Boolean(node.hidden), width: node.width, height: node.height }))] } : view);
      const payload: ArchitectureDraftInput = { base_revision_id: data?.revisions[0]?.id || 0, components: graph.components, relationships: graph.relationships, views: nextViews };
      return saveProjectArchitecture(organizationId, projectId, payload);
    },
    onSuccess: (nextGraph) => { queryClient.setQueryData(['project-architecture', organizationId, projectId], (current: typeof data) => current ? { ...current, graph: nextGraph } : current); setDraftNodes(null); setDraftDirty(false); },
  });
  const commitMutation = useMutation({ mutationFn: () => commitProjectArchitecture(organizationId, projectId, 'Committed architecture draft.'), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-architecture', organizationId, projectId] }) });
  const agentMutation = useMutation({
    mutationFn: () => createProjectAgentRun(organizationId, projectId, agentPrompt),
    onSuccess: () => { setAgentPrompt(''); queryClient.invalidateQueries({ queryKey: ['project-agent-runs', organizationId, projectId] }); },
  });
  const reviewRun = reviewRunId === null ? (runsQuery.data || []).find((run) => run.state === 'awaiting_plan_review') : (runsQuery.data || []).find((run) => run.id === reviewRunId && run.state === 'awaiting_plan_review');
  const discoveryRun = (runsQuery.data || []).find((run) => run.state === 'awaiting_input' && run.questions.length > 0);
  const approveMutation = useMutation({
    mutationFn: () => { if (!reviewRun) throw new Error('Select a proposal to review'); return approveProjectAgentRun(organizationId, projectId, reviewRun.id); },
    onSuccess: async () => {
      // Approval changes canonical graph data. Refetch it before removing the review state so the
      // canvas cannot continue rendering a stale local React Flow snapshot.
      setDraftNodes(null);
      setDraftDirty(false);
      await queryClient.refetchQueries({ queryKey: ['project-architecture', organizationId, projectId], type: 'active' });
      setReviewRunId(null);
      await queryClient.refetchQueries({ queryKey: ['project-agent-runs', organizationId, projectId], type: 'active' });
    },
  });
  const changesMutation = useMutation({
    mutationFn: () => { if (!reviewRun) throw new Error('Select a proposal to review'); return requestProjectAgentChanges(organizationId, projectId, reviewRun.id, changeFeedback); },
    onSuccess: () => { setChangeFeedback(''); setReviewRunId(null); queryClient.invalidateQueries({ queryKey: ['project-agent-runs', organizationId, projectId] }); },
  });

  const onNodesChange: OnNodesChange<Node<ArchitectureNodeData>> = (changes) => {
    setDraftNodes((current) => applyNodeChanges(changes, current || nodes));
    if (changes.some((change) => change.type === 'position' || change.type === 'dimensions')) setDraftDirty(true);
  };
  const updateSelected = (changes: Partial<Pick<ArchitectureComponent, 'name' | 'description' | 'type' | 'parent_id' | 'responsibilities' | 'technologies' | 'requirements' | 'constraints'>>) => {
    if (!selectedId) return;
    queryClient.setQueryData(['project-architecture', organizationId, projectId], (current: typeof data) => current ? { ...current, graph: { ...current.graph, components: current.graph.components.map((component) => component.id === selectedId ? { ...component, ...changes, updated_at: new Date().toISOString() } : component) } } : current);
    setDraftDirty(true);
  };
  // Updates a newly created relationship inline without opening a second form flow.
  const updateRelationshipType = (relationshipId: string, type: ArchitectureRelationshipType) => {
    queryClient.setQueryData(['project-architecture', organizationId, projectId], (current: typeof data) => current ? { ...current, graph: { ...current.graph, relationships: current.graph.relationships.map((relationship) => relationship.id === relationshipId ? { ...relationship, type, label: type.replaceAll('_', ' '), updated_at: new Date().toISOString() } : relationship) } } : current);
    setDraftDirty(true);
    setPendingRelationshipId(null);
  };
  const connectComponents = (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const sourceComponent = graph?.components.find((component) => component.id === connection.source);
    const targetComponent = graph?.components.find((component) => component.id === connection.target);
    const relationshipType = inferArchitectureRelationshipType(sourceComponent, targetComponent);
    const relationshipId = crypto.randomUUID();
    queryClient.setQueryData(['project-architecture', organizationId, projectId], (current: typeof data) => current ? { ...current, graph: { ...current.graph, relationships: [...current.graph.relationships, { id: relationshipId, project_id: Number(projectId), source_component_id: connection.source, target_component_id: connection.target, type: relationshipType, label: relationshipType.replaceAll('_', ' '), metadata: { sourceHandle: connection.sourceHandle || undefined, targetHandle: connection.targetHandle || undefined }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] } } : current);
    setDraftDirty(true);
    setPendingRelationshipId(relationshipId);
    setRailTab('inspect');
  };
  const addComponent = (type: ArchitectureComponentType) => {
    if (!graph) return;
    const component: ArchitectureComponent = { id: crypto.randomUUID(), project_id: Number(projectId), type, name: `New ${componentTypeLabels[type]} ${graph.components.length + 1}`, description: architectureComponentCatalog.find((entry) => entry.type === type)?.description || 'Define this component responsibility.', parent_id: null, responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    queryClient.setQueryData(['project-architecture', organizationId, projectId], (current: typeof data) => current ? { ...current, graph: { ...current.graph, components: [...current.graph.components, component] } } : current);
    setDraftDirty(true);
    setSelectedId(component.id);
    setNewNodeId(component.id);
    setEditingNodeId(component.id);
    setNodePaletteOpen(false);
    setNodePaletteQuery('');
  };
  const removeSelected = () => {
    if (!selectedId || !graph) return;
    queryClient.setQueryData(['project-architecture', organizationId, projectId], (current: typeof data) => current ? { ...current, graph: { ...current.graph, components: current.graph.components.filter((component) => component.id !== selectedId), relationships: current.graph.relationships.filter((edge) => edge.source_component_id !== selectedId && edge.target_component_id !== selectedId) } } : current);
    setDraftDirty(true);
    setDraftNodes((current) => current ? current.filter((node) => node.id !== selectedId) : current);
    setSelectedId(null);
  };

  if (isLoading) return <div className="app-page"><Surface variant="strong" className="rounded-[2rem] p-8">Loading architecture workspace...</Surface></div>;
  if (isError || !data || !graph) return <div className="app-page"><Surface variant="strong" className="rounded-[2rem] p-8 text-sm app-error-text">Failed to load architecture workspace.</Surface></div>;

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] min-w-0 flex-col gap-4">
      <Surface variant="strong" className="rounded-[1.5rem] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0"><p className="app-kicker">Architecture project</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{data.project.name}</h1><Badge><GitBranch className="h-3.5 w-3.5" /> Rev {data.revisions[0]?.version || 1}</Badge></div><p className="mt-1 max-w-2xl text-sm app-text-muted">{data.project.description || 'Design the system from requirements to implementation.'}</p></div>
          <div className="flex flex-wrap items-center justify-end gap-2"><span className={cn('mr-1 text-xs', draftDirty ? 'text-[var(--app-foreground)]' : 'app-text-muted')}>{draftDirty ? 'Unsaved changes' : 'Draft saved'}</span><Button size="sm" onClick={() => setNodePaletteOpen(true)}><Plus className="h-4 w-4" /> Add component</Button><Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !draftDirty}><Save className="h-4 w-4" /> {saveMutation.isPending ? 'Saving' : 'Save draft'}</Button><Button size="sm" variant="primary" onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending || draftDirty}><Check className="h-4 w-4" /> {commitMutation.isPending ? 'Committing' : 'Commit revision'}</Button></div>
        </div>
      </Surface>
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Surface variant="strong" className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-[1.5rem]">
          <div role="tablist" aria-label="Architecture views" className="flex gap-2 overflow-x-auto border-b border-[var(--app-border)] p-3">{(Object.keys(viewLabels) as ArchitectureViewKey[]).map((key) => <button key={key} role="tab" aria-selected={activeView === key} type="button" onClick={() => { setActiveView(key); setDraftNodes(null); }} className={cn('shrink-0 rounded-xl px-3 py-2 text-sm transition-colors', activeView === key ? 'bg-[var(--app-foreground)] text-[var(--app-panel)]' : 'app-text-muted hover:bg-[var(--app-panel-soft)]')}>{viewLabels[key]}</button>)}<span className="ml-auto hidden shrink-0 items-center gap-2 text-xs app-text-muted sm:flex"><Sparkles className="h-3.5 w-3.5" /> Agent workspace</span></div>
          <div ref={canvasRef} className="architecture-flow relative min-h-0 flex-1"><ReactFlow nodes={displayedNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onConnect={connectComponents} connectionLineType={ConnectionLineType.SmoothStep} onNodeClick={(_, node) => { setSelectedId(node.id); setSelectedRelationshipId(null); setEditingNodeId(null); setRailTab('inspect'); }} onNodeDoubleClick={(_, node) => { setSelectedId(node.id); setSelectedRelationshipId(null); setEditingNodeId(node.id); setRailTab('inspect'); }} onEdgeClick={(_, edge) => { setSelectedId(null); setSelectedRelationshipId(edge.id); setRailTab('inspect'); }} onPaneClick={(event) => { if (event.detail === 2 && canvasRef.current) { const bounds = canvasRef.current.getBoundingClientRect(); const x = event.clientX - bounds.left; const y = event.clientY - bounds.top; setQuickActionsPosition({ left: x > bounds.width - 300 ? x - 282 : x + 16, top: y > bounds.height - 240 ? y - 230 : y + 16 }); setNodeCreationPosition({ x: Math.max(32, x - 90), y: Math.max(32, y - 45) }); setQuickActionsOpen(true); } }} fitView proOptions={{ hideAttribution: true }}><Background color="var(--app-border)" gap={24} /><Controls /><MiniMap /></ReactFlow><div className="architecture-flow-legend" aria-label="Architecture flow legend"><span><i className="architecture-flow-legend-dot" />Live data flow</span><span><i className="architecture-flow-legend-line" />Dependency</span></div>{quickActionsOpen ? <div style={{ left: quickActionsPosition.left, top: quickActionsPosition.top }} className="absolute z-10 w-64 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel-strong)] p-4 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="app-kicker">Canvas actions</p><h2 className="mt-1 text-base font-semibold">What would you like to do?</h2></div><button type="button" onClick={() => setQuickActionsOpen(false)} className="app-text-muted" aria-label="Close canvas actions">×</button></div><div className="mt-4 grid gap-2"><Button size="sm" className="justify-start" onClick={() => { setNodePaletteOpen(true); setQuickActionsOpen(false); }}><Plus className="h-4 w-4" /> Add typed component</Button><Button size="sm" className="justify-start" onClick={() => { setRailTab('agent'); setQuickActionsOpen(false); }}><Sparkles className="h-4 w-4" /> Ask the architecture agent</Button><Button size="sm" className="justify-start" onClick={() => { setRailTab('history'); setQuickActionsOpen(false); }}><History className="h-4 w-4" /> Open revision history</Button></div></div> : null}{nodePaletteOpen ? <div className="architecture-node-palette absolute left-4 top-4 z-20 w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel-strong)] p-4 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="app-kicker">Create from catalog</p><h2 className="mt-1 text-base font-semibold">Choose a system building block</h2></div><button type="button" onClick={() => setNodePaletteOpen(false)} className="app-text-muted" aria-label="Close component catalog"><X className="h-4 w-4" /></button></div><div className="relative mt-4"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 app-text-muted" /><input autoFocus value={nodePaletteQuery} onChange={(event) => setNodePaletteQuery(event.target.value)} placeholder="Search services, data, security..." className="app-input w-full rounded-xl py-2 pl-9 pr-3 text-sm" aria-label="Search component types" /></div><div className="mt-3 max-h-72 space-y-1 overflow-y-auto">{filteredCatalog.map((entry) => <button key={entry.type} type="button" onClick={() => addComponent(entry.type)} className="architecture-node-palette-option w-full rounded-xl p-3 text-left"><span className="block text-sm font-medium">{entry.label}</span><span className="mt-1 block text-xs app-text-muted">{entry.description}</span></button>)}{!filteredCatalog.length ? <p className="p-3 text-sm app-text-muted">No matching component types.</p> : null}</div><p className="mt-3 text-xs app-text-muted">The node is created immediately, then you can rename it inline.</p></div> : null}</div>
        </Surface>
        <div className="sticky top-4 flex min-h-0 flex-col gap-3 self-start xl:max-h-[calc(100dvh-7rem)]">
        <nav aria-label="Workspace details" className="app-surface-strong flex gap-1 overflow-x-auto rounded-[1.25rem] p-1.5">
          {([['inspect', 'Inspect'], ['agent', 'Agent'], ['review', 'Review'], ['history', 'History']] as [WorkspaceRailTab, string][]).map(([key, label]) => <button key={key} type="button" aria-current={railTab === key ? 'page' : undefined} onClick={() => setRailTab(key)} className={cn('relative flex min-h-10 shrink-0 items-center justify-center rounded-lg px-3 text-sm transition-colors', railTab === key ? 'bg-[var(--app-foreground)] font-medium text-[var(--app-panel)]' : 'app-text-muted hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-foreground)]')}>{label}{key === 'review' && reviewRun ? <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-[var(--app-foreground)]" /> : null}</button>)}
        </nav>
        <Button size="sm" className="w-full" onClick={() => setRailTab('collaboration')}>Open discussion</Button>
        {railTab === 'collaboration' ? <ArchitectureCollaborationPanel organizationId={organizationId} projectId={projectId} componentId={selectedId} relationshipId={selectedRelationshipId} revisionId={data.revisions[0]?.id} threads={collaboration.threads} className="min-h-[32rem]" /> : null}
        <div className="min-h-0 overflow-y-auto pr-1">
        {railTab === 'inspect' ? <Surface variant="strong" className="rounded-[1.5rem] p-5">
          <div className="flex items-center justify-between"><div><p className="app-kicker">Component inspector</p><h2 className="mt-2 text-lg font-semibold">{selected?.name || 'Select a component'}</h2></div>{selected ? <Button size="icon" variant="danger" onClick={removeSelected} aria-label="Remove component"><Trash2 className="h-4 w-4" /></Button> : null}</div>
          {selected ? <div className="mt-6 space-y-5 text-sm"><div><label htmlFor="component-name" className="app-text-muted">Name</label><input id="component-name" value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} className="app-input mt-2 w-full rounded-xl px-3 py-2 font-medium" /></div><div><label htmlFor="component-type" className="app-text-muted">Component type</label><select id="component-type" value={selected.type} onChange={(event) => updateSelected({ type: event.target.value as ArchitectureComponentType })} className="app-input mt-2 w-full rounded-xl px-3 py-2"><option value="">Choose a type</option>{architectureComponentTypes.map((type) => <option key={type} value={type}>{componentTypeLabels[type]}</option>)}</select></div><div><label htmlFor="component-description" className="app-text-muted">Purpose</label><textarea id="component-description" value={selected.description || ''} onChange={(event) => updateSelected({ description: event.target.value })} rows={3} className="app-input mt-2 w-full resize-y rounded-xl p-3 leading-6" /></div><div><p className="app-text-muted">Responsibilities</p><p className="mt-1 leading-6">{selected.responsibilities.length ? selected.responsibilities.join(', ') : 'Add responsibilities during refinement.'}</p></div>{pendingRelationship ? <div className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] p-3"><p className="text-xs font-medium">Connection type</p><p className="mt-1 text-xs app-text-muted">Axxon suggested <span className="font-medium text-[var(--app-foreground)]">{pendingRelationship.type.replaceAll('_', ' ')}</span>. Adjust it if this flow means something else.</p><select aria-label="Connection type" value={pendingRelationship.type} onChange={(event) => updateRelationshipType(pendingRelationship.id, event.target.value as ArchitectureRelationshipType)} className="app-input mt-3 w-full rounded-lg px-2 py-1.5 text-xs">{['depends_on', 'calls', 'reads_from', 'writes_to', 'publishes_to', 'subscribes_to', 'authenticates_through', 'deployed_on', 'monitored_by', 'secured_by'].map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></div> : null}<div className="border-t border-[var(--app-border)] pt-4"><p className="app-kicker">Dependencies</p><p className="mt-2 app-text-muted">{graph.relationships.filter((edge) => edge.source_component_id === selected.id || edge.target_component_id === selected.id).length} connected relationships</p></div><Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !draftDirty}><Save className="h-4 w-4" /> Save component changes</Button></div> : <p className="mt-6 text-sm leading-6 app-text-muted">Select a node to inspect and rename it, edit its purpose, or remove it from the architecture.</p>}
        </Surface> : null}
        {railTab === 'agent' ? <Surface variant="strong" className="rounded-[1.5rem] p-5">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /><div><p className="app-kicker">Architecture agent</p><h2 className="mt-1 text-lg font-semibold">Ask Axxon to design</h2></div></div>
          {discoveryRun ? <ArchitectureDiscoveryPanel organizationId={organizationId} projectId={projectId} run={discoveryRun} onSubmitted={() => runsQuery.refetch()} /> : null}
          <label htmlFor="architecture-agent-prompt" className="sr-only">Architecture request</label><textarea id="architecture-agent-prompt" value={agentPrompt} onChange={(event) => setAgentPrompt(event.target.value)} rows={4} placeholder="Describe the system or architecture change..." className="app-input mt-4 min-h-24 w-full resize-y rounded-xl p-3 text-sm" />
          <Button className="mt-3 w-full" variant="primary" onClick={() => agentMutation.mutate()} disabled={agentMutation.isPending || !agentPrompt.trim()}>{agentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {agentMutation.isPending ? 'Starting run' : 'Start architecture run'}</Button>
          {agentMutation.isError ? <p role="alert" className="mt-3 text-xs app-error-text">{agentMutation.error.message}</p> : null}
          <div className="mt-5 space-y-3 border-t border-[var(--app-border)] pt-4">
            {(runsQuery.data || []).slice(0, 4).map((run: AgentRun) => <div key={run.id} className={cn('rounded-xl border p-3', reviewRun?.id === run.id ? 'border-[var(--app-foreground)]' : 'border-[var(--app-border)]')}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">Run #{run.id}</span><Badge variant={run.state === 'failed' ? 'danger' : run.state === 'awaiting_plan_review' ? 'success' : 'default'}>{run.state === 'awaiting_plan_review' ? 'Ready for review' : run.state.replaceAll('_', ' ')}</Badge></div><p className="mt-2 text-xs app-text-muted">{run.planArtifact?.architectureProposal?.summary || run.prompt}</p>{run.planArtifact?.architectureProposal ? <p className="mt-2 text-xs app-text-muted">{run.planArtifact.architectureProposal.operations.length} proposed operations</p> : null}{run.state === 'awaiting_plan_review' ? <Button size="sm" className="mt-3 w-full" onClick={() => setReviewRunId(run.id)}><History className="h-3.5 w-3.5" /> Review proposal</Button> : null}</div>)}
            {!runsQuery.data?.length ? <p className="text-xs app-text-muted">No architecture runs yet.</p> : null}
          </div>
        </Surface> : null}
        {railTab === 'review' ? (reviewRun?.planArtifact?.architectureProposal && reviewRun.state === 'awaiting_plan_review' ? <Surface variant="strong" className="rounded-[1.5rem] p-5"><div className="flex items-center justify-between gap-3"><div><p className="app-kicker">Semantic diff</p><h2 className="mt-1 text-lg font-semibold">Review run #{reviewRun.id}</h2></div><Badge variant="success">Revision {reviewRun.planArtifact.architectureProposal.baseRevisionId} base</Badge></div><p className="mt-3 text-sm leading-6 app-text-muted">{reviewRun.planArtifact.architectureProposal.summary}</p><ArchitectureProposalPreview graph={graph} operations={reviewRun.planArtifact.architectureProposal.operations} /><div className="mt-4 space-y-2">{reviewRun.planArtifact.architectureProposal.operations.map((operation, index) => <div key={`${String(operation.type)}-${index}`} className="border-l-2 border-[var(--app-foreground)] py-1 pl-3 text-sm"><p>{operationLabel(operation, graph)}</p><p className="mt-1 text-xs app-text-muted">{operationDetails(operation, graph)}</p></div>)}</div>{reviewRun.planArtifact.architectureProposal.risks.length ? <div className="mt-4 border-t border-[var(--app-border)] pt-4"><p className="app-kicker">Risks</p><ul className="mt-2 space-y-1 text-xs app-text-muted">{reviewRun.planArtifact.architectureProposal.risks.map((risk) => <li key={risk}>• {risk}</li>)}</ul></div> : null}<label htmlFor="architecture-change-feedback" className="sr-only">Requested architecture changes</label><textarea id="architecture-change-feedback" value={changeFeedback} onChange={(event) => setChangeFeedback(event.target.value)} rows={3} placeholder="What should Axxon revise?" className="app-input mt-4 w-full resize-y rounded-xl p-3 text-sm" /><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="primary" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || changesMutation.isPending}>{approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve</Button><Button onClick={() => changesMutation.mutate()} disabled={changesMutation.isPending || !changeFeedback.trim()}>{changesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Request changes</Button></div>{approveMutation.isError || changesMutation.isError ? <p role="alert" className="mt-3 text-xs app-error-text">{(approveMutation.error || changesMutation.error)?.message}</p> : null}</Surface> : <Surface variant="strong" className="rounded-[1.5rem] p-5"><p className="app-kicker">Review queue</p><h2 className="mt-2 text-lg font-semibold">No proposal selected</h2><p className="mt-2 text-sm leading-6 app-text-muted">When an architecture run is ready, open it from the Agent tab and review its proposed changes here.</p></Surface>) : null}
        {railTab === 'history' ? <Surface variant="strong" className="rounded-[1.5rem] p-5"><div className="flex items-center gap-2"><History className="h-4 w-4" /><div><p className="app-kicker">Revision history</p><h2 className="mt-1 text-lg font-semibold">Immutable snapshots</h2></div></div><div className="mt-4 space-y-3">{data.revisions.map((revision) => <div key={revision.id} className="flex items-start justify-between gap-3 border-t border-[var(--app-border)] pt-3 text-sm"><div><p className="font-medium">Revision {revision.version}</p><p className="mt-1 text-xs app-text-muted">{revision.summary || 'No summary'} · {revision.created_by ? `user ${revision.created_by}` : 'system'}{revision.parent_revision_id ? ` · parent ${revision.parent_revision_id}` : ''}</p></div><span className="text-xs app-text-muted">{new Date(revision.created_at).toLocaleDateString()}</span></div>)}</div></Surface> : null}
        </div>
        </div>
      </div>
    </div>
  );
}

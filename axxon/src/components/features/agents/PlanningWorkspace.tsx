// Renders the org-level planning workspace as a board-scoped chat surface for agent runs.
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Loader2,
  MessageSquareText,
  PanelLeft,
  Plus,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import SideDrawer from '@/components/ui/SideDrawer';
import Surface from '@/components/ui/Surface';
import { useAgentRunsRealtime } from '@/hooks/useAgentRunsRealtime';
import { useSocket } from '@/hooks/useSocket';
import {
  approveAgentRunPlan,
  cancelAgentRun,
  createPlanningAgentRun,
  fetchAgentRunDetail,
  fetchAgentRuns,
  requestAgentRunChanges,
  retryAgentRun,
  submitAgentRunInput,
  submitAgentRunMessage,
} from '@/lib/api/agents/agentRuns';
import { fetchBoards } from '@/lib/api/boards/getBoards';
import type {
  AgentClarificationAnswer,
  AgentPlanArtifact,
  AgentQuestion,
  AgentRun,
  AgentRunDetail,
  AgentRunMessage,
  AgentRunState,
} from '@/lib/types/agentTypes';
import type { BoardBaseData } from '@/lib/types/boardTypes';
import { cn } from '@/lib/utils/cn';

const activeStates = new Set<AgentRunState>(['queued', 'preparing', 'planning', 'dispatching']);
const collapsedMessageLength = 420;

const stateLabels: Record<AgentRunState, string> = {
  queued: 'Queued',
  preparing: 'Preparing',
  awaiting_input: 'Needs input',
  awaiting_message: 'Needs message',
  planning: 'Planning',
  awaiting_plan_review: 'Plan review',
  dispatching: 'Dispatching',
  dispatched: 'Dispatched',
  executing: 'Executing',
  awaiting_result_review: 'Result review',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

// Formats run timestamps for compact sidebar and thread metadata.
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

// Checks whether the backend currently allows a run action for this actor.
function hasCapability(run: AgentRunDetail | undefined, capability: string) {
  return Boolean(run?.capabilities.includes(capability as never));
}

// Maps lifecycle states onto existing semantic badge variants.
function stateBadgeVariant(state: AgentRunState) {
  if (state === 'completed' || state === 'awaiting_plan_review') return 'success' as const;
  if (state === 'failed' || state === 'cancelled') return 'danger' as const;
  return 'default' as const;
}

// Returns concise working-state copy for the assistant status row.
function getWorkingCopy(run: AgentRunDetail) {
  const state = run.state;
  if (state === 'queued') return ['Queued for planning', 'The agent will read the latest context shortly.'];
  if (state === 'preparing') return ['Preparing context', 'The worker is collecting the run transcript and board context.'];
  if (state === 'planning' && run.readiness?.recommendedNextAction === 'complete_planning') {
    return ['Generating implementation plan', 'The agent has enough context and is drafting the reviewable plan.'];
  }
  if (state === 'planning') return ['Analyzing requirements', 'The agent is deciding whether to ask questions or draft the plan.'];
  if (state === 'dispatching') return ['Dispatching approved plan', 'The approved plan is being handed to the next agent stage.'];
  return ['Agent is working', 'This thread updates when the board receives the next agent-run event.'];
}

// Returns the persisted transcript, synthesizing the initial prompt only when older data has no messages.
function getThreadMessages(run: AgentRunDetail): AgentRunMessage[] {
  if (run.messages.length > 0) return run.messages;

  return [{
    id: -run.id,
    runId: run.id,
    role: 'user',
    content: run.prompt,
    metadata: null,
    createdAt: run.createdAt,
  }];
}

// Hosts board selection, run history, thread rendering, and the contextual composer.
export default function PlanningWorkspace({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [isNewPlanMode, setIsNewPlanMode] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [feedback, setFeedback] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const socketRef = useSocket(selectedBoardId);

  const { data: boards = [], isLoading: isBoardsLoading } = useQuery<BoardBaseData[]>({
    queryKey: ['boards', organizationId],
    queryFn: () => fetchBoards(organizationId),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!selectedBoardId && boards.length > 0) {
      setSelectedBoardId(String(boards[0].id));
    }
  }, [boards, selectedBoardId]);

  const selectedBoard = useMemo(
    () => boards.find((board) => String(board.id) === selectedBoardId) ?? null,
    [boards, selectedBoardId]
  );

  const { data: runs = [], isLoading: isRunsLoading } = useQuery<AgentRun[]>({
    queryKey: ['agent-runs', organizationId, selectedBoardId],
    queryFn: () => fetchAgentRuns(organizationId, selectedBoardId!),
    enabled: Boolean(selectedBoardId),
  });

  useEffect(() => {
    if (isNewPlanMode) return;
    if (!selectedRunId && runs.length > 0) {
      setSelectedRunId(runs[0].id);
    }
  }, [isNewPlanMode, runs, selectedRunId]);

  useAgentRunsRealtime(organizationId, selectedBoardId, socketRef);

  const { data: activeRun, isLoading: isRunLoading } = useQuery<AgentRunDetail>({
    queryKey: ['agent-run', organizationId, selectedBoardId, selectedRunId],
    queryFn: () => fetchAgentRunDetail(organizationId, selectedBoardId!, selectedRunId!),
    enabled: Boolean(selectedBoardId && selectedRunId),
  });

  const refreshAgentQueries = (run: AgentRunDetail) => {
    queryClient.setQueryData(['agent-run', organizationId, selectedBoardId, run.id], run);
    queryClient.invalidateQueries({ queryKey: ['agent-runs', organizationId, selectedBoardId] });
  };

  const createMutation = useMutation({
    mutationFn: () => createPlanningAgentRun(organizationId, selectedBoardId!, prompt.trim()),
    onSuccess: (run) => {
      setPrompt('');
      setIsNewPlanMode(false);
      setSelectedRunId(run.id);
      refreshAgentQueries(run);
    },
  });

  const inputMutation = useMutation({
    mutationFn: (answers: AgentClarificationAnswer[]) =>
      submitAgentRunInput(organizationId, selectedBoardId!, activeRun!.id, answers),
    onSuccess: refreshAgentQueries,
  });

  const messageMutation = useMutation({
    mutationFn: () => submitAgentRunMessage(organizationId, selectedBoardId!, activeRun!.id, messageDraft.trim()),
    onSuccess: (run) => {
      setMessageDraft('');
      refreshAgentQueries(run);
    },
  });

  const changesMutation = useMutation({
    mutationFn: () => requestAgentRunChanges(organizationId, selectedBoardId!, activeRun!.id, feedback.trim()),
    onSuccess: (run) => {
      setFeedback('');
      refreshAgentQueries(run);
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveAgentRunPlan(organizationId, selectedBoardId!, activeRun!.id),
    onSuccess: refreshAgentQueries,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelAgentRun(organizationId, selectedBoardId!, activeRun!.id),
    onSuccess: refreshAgentQueries,
  });

  const retryMutation = useMutation({
    mutationFn: () => retryAgentRun(organizationId, selectedBoardId!, activeRun!.id),
    onSuccess: refreshAgentQueries,
  });

  const hasSelectedRun = Boolean(activeRun && !isNewPlanMode);
  const selectedRun = hasSelectedRun ? activeRun! : null;
  const canSendRunMessage = hasSelectedRun && hasCapability(activeRun, 'submit_message');
  const isAnyMutationPending =
    createMutation.isPending ||
    inputMutation.isPending ||
    messageMutation.isPending ||
    changesMutation.isPending ||
    approveMutation.isPending ||
    cancelMutation.isPending ||
    retryMutation.isPending;
  const actionError =
    createMutation.error?.message ||
    inputMutation.error?.message ||
    messageMutation.error?.message ||
    changesMutation.error?.message ||
    approveMutation.error?.message ||
    cancelMutation.error?.message ||
    retryMutation.error?.message ||
    null;

  const openNewPlan = () => {
    setIsNewPlanMode(true);
    setSelectedRunId(null);
    setMessageDraft('');
    setFeedback('');
    setIsHistoryOpen(false);
  };
  const selectRun = (runId: number) => {
    setIsNewPlanMode(false);
    setSelectedRunId(runId);
    setMessageDraft('');
    setFeedback('');
    setIsHistoryOpen(false);
  };
  const selectBoard = (boardId: string | null) => {
    setSelectedBoardId(boardId);
    setSelectedRunId(null);
    setIsNewPlanMode(false);
    setPrompt('');
    setMessageDraft('');
    setFeedback('');
  };

  return (
    <div className="app-page h-[calc(100vh-5.5rem)] min-h-[40rem] max-w-[1600px] overflow-hidden">
      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="hidden w-[21rem] shrink-0 lg:block">
          <RunSidebar
            runs={runs}
            selectedRunId={hasSelectedRun ? selectedRunId : null}
            selectedBoard={selectedBoard}
            isLoading={isRunsLoading}
            isNewPlanMode={isNewPlanMode || !activeRun}
            onNewPlan={openNewPlan}
            onSelectRun={selectRun}
          />
        </aside>

        <Surface variant="strong" className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[1.5rem]">
          <ChatHeader
            activeRun={selectedRun}
            boards={boards}
            selectedBoardId={selectedBoardId}
            isBoardsLoading={isBoardsLoading}
            onBoardChange={selectBoard}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onNewPlan={openNewPlan}
          />

          <ChatThread
            run={selectedRun}
            isRunLoading={Boolean(selectedRunId && isRunLoading)}
            isNewPlanMode={isNewPlanMode || !activeRun}
            feedback={feedback}
            onFeedbackChange={setFeedback}
            onSubmitAnswers={(answers) => inputMutation.mutate(answers)}
            onRequestChanges={() => changesMutation.mutate()}
            onApprove={() => approveMutation.mutate()}
            onRetry={() => retryMutation.mutate()}
            isSubmitting={isAnyMutationPending}
          />

          <ChatComposer
            mode={canSendRunMessage ? 'message' : 'create'}
            value={canSendRunMessage ? messageDraft : prompt}
            disabledReason={!selectedBoardId ? 'Select a board before starting a plan.' : null}
            isSubmitting={canSendRunMessage ? messageMutation.isPending : createMutation.isPending}
            selectedRun={selectedRun}
            canCancel={hasCapability(selectedRun ?? undefined, 'cancel')}
            isCanceling={cancelMutation.isPending}
            onChange={canSendRunMessage ? setMessageDraft : setPrompt}
            onSubmit={() => {
              if (canSendRunMessage) {
                messageMutation.mutate();
              } else {
                createMutation.mutate();
              }
            }}
            onCancel={() => cancelMutation.mutate()}
            onNewPlan={openNewPlan}
          />

          {actionError ? (
            <div className="border-t border-[var(--app-border)] px-4 py-3 text-sm text-[var(--app-danger)] sm:px-6">
              {actionError}
            </div>
          ) : null}
        </Surface>
      </div>

      <SideDrawer
        isOpen={isHistoryOpen}
        title="Planning runs"
        description={selectedBoard?.name ?? 'Select a board to load run history.'}
        onClose={() => setIsHistoryOpen(false)}
      >
        <RunSidebar
          runs={runs}
          selectedRunId={hasSelectedRun ? selectedRunId : null}
          selectedBoard={selectedBoard}
          isLoading={isRunsLoading}
          isNewPlanMode={isNewPlanMode || !activeRun}
          onNewPlan={openNewPlan}
          onSelectRun={selectRun}
        />
      </SideDrawer>
    </div>
  );
}

// Renders the compact desktop/mobile run history control.
function RunSidebar({
  runs,
  selectedRunId,
  selectedBoard,
  isLoading,
  isNewPlanMode,
  onNewPlan,
  onSelectRun,
}: {
  runs: AgentRun[];
  selectedRunId: number | null;
  selectedBoard: BoardBaseData | null;
  isLoading: boolean;
  isNewPlanMode: boolean;
  onNewPlan: () => void;
  onSelectRun: (runId: number) => void;
}) {
  return (
    <Surface variant="strong" className="flex h-full flex-col overflow-hidden rounded-[1.5rem]">
      <div className="border-b border-[var(--app-border)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="app-kicker">Planning runs</p>
            <h2 className="mt-2 truncate text-lg font-semibold">{selectedBoard?.name ?? 'Board runs'}</h2>
          </div>
          <Badge>{runs.length} runs</Badge>
        </div>
        <Button className="mt-4 w-full" variant="primary" onClick={onNewPlan}>
          <Plus className="h-4 w-4" />
          New plan
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <RunStatusCard label="Loading runs..." />
        ) : runs.length === 0 ? (
          <RunStatusCard label="No planning runs yet. Start from the composer below." />
        ) : (
          <div className="space-y-2">
            {isNewPlanMode ? (
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--app-accent)_45%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_9%,var(--app-panel-strong))] p-3">
                <p className="text-sm font-medium">New planning run</p>
                <p className="mt-1 text-xs app-text-muted">Use the composer to start a fresh plan.</p>
              </div>
            ) : null}
            {runs.map((run) => (
              <RunListItem
                key={run.id}
                run={run}
                isSelected={selectedRunId === run.id}
                onSelect={() => onSelectRun(run.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Surface>
  );
}

// Renders one compact run row in the history sidebar.
function RunListItem({
  run,
  isSelected,
  onSelect,
}: {
  run: AgentRun;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-2xl border p-3 text-left transition',
        isSelected
          ? 'border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel-strong))]'
          : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_76%,transparent)] hover:border-[color-mix(in_srgb,var(--app-accent)_30%,var(--app-border))]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{run.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 app-text-muted">{run.prompt}</p>
        </div>
        <Badge variant={stateBadgeVariant(run.state)}>{stateLabels[run.state]}</Badge>
      </div>
      <p className="mt-2 text-xs app-text-muted">{formatDate(run.updatedAt)}</p>
    </button>
  );
}

// Renders the chat header with mobile history access and board selection.
function ChatHeader({
  activeRun,
  boards,
  selectedBoardId,
  isBoardsLoading,
  onBoardChange,
  onOpenHistory,
  onNewPlan,
}: {
  activeRun: AgentRunDetail | null;
  boards: BoardBaseData[];
  selectedBoardId: string | null;
  isBoardsLoading: boolean;
  onBoardChange: (boardId: string | null) => void;
  onOpenHistory: () => void;
  onNewPlan: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-strong)_94%,transparent)] px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button className="lg:hidden" size="icon" aria-label="Open planning runs" onClick={onOpenHistory}>
            <PanelLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))]">
            <Bot className="h-5 w-5 text-[var(--app-accent-strong)]" />
          </div>
          <div className="min-w-0">
            <p className="app-kicker">Agent planning</p>
            <h1 className="truncate text-lg font-semibold sm:text-xl">
              {activeRun?.title ?? 'New planning run'}
            </h1>
          </div>
          {activeRun ? <Badge variant={stateBadgeVariant(activeRun.state)}>{stateLabels[activeRun.state]}</Badge> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button className="hidden lg:inline-flex" onClick={onNewPlan}>
            <Plus className="h-4 w-4" />
            New plan
          </Button>
          <BoardSelector
            boards={boards}
            selectedBoardId={selectedBoardId}
            isLoading={isBoardsLoading}
            onChange={onBoardChange}
          />
        </div>
      </div>
    </header>
  );
}

// Renders the board dropdown in the chat toolbar.
function BoardSelector({
  boards,
  selectedBoardId,
  isLoading,
  onChange,
}: {
  boards: BoardBaseData[];
  selectedBoardId: string | null;
  isLoading: boolean;
  onChange: (boardId: string | null) => void;
}) {
  return (
    <label className="app-select-shell flex min-w-[15rem] items-center gap-2 px-3 py-2">
      <GitBranch className="h-4 w-4 app-text-muted" />
      <span className="sr-only">Board context</span>
      <select
        className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
        value={selectedBoardId ?? ''}
        disabled={isLoading || boards.length === 0}
        onChange={(event) => onChange(event.target.value || null)}
      >
        {boards.length === 0 ? (
          <option value="">No boards available</option>
        ) : (
          boards.map((board) => (
            <option key={board.id} value={String(board.id)}>
              {board.name || 'Untitled Board'}
            </option>
          ))
        )}
      </select>
      <ChevronDown className="h-4 w-4 app-text-muted" />
    </label>
  );
}

// Renders the selected run as a centered chat transcript with inline agent artifacts.
function ChatThread({
  run,
  isRunLoading,
  isNewPlanMode,
  feedback,
  onFeedbackChange,
  onSubmitAnswers,
  onRequestChanges,
  onApprove,
  onRetry,
  isSubmitting,
}: {
  run: AgentRunDetail | null;
  isRunLoading: boolean;
  isNewPlanMode: boolean;
  feedback: string;
  onFeedbackChange: (value: string) => void;
  onSubmitAnswers: (answers: AgentClarificationAnswer[]) => void;
  onRequestChanges: () => void;
  onApprove: () => void;
  onRetry: () => void;
  isSubmitting: boolean;
}) {
  if (isRunLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <RunStatusCard label="Loading selected run..." />
      </div>
    );
  }

  if (!run || isNewPlanMode) {
    return <NewPlanEmptyState />;
  }

  const [workingTitle, workingDescription] = getWorkingCopy(run);
  const messages = getThreadMessages(run);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            role={message.role === 'user' ? 'user' : 'agent'}
            timestamp={formatDate(message.createdAt)}
          >
            <ExpandableMessageContent content={message.content} />
          </ChatMessage>
        ))}

        {activeStates.has(run.state) ? (
          <ChatMessage role="agent">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--app-accent)]" />
              <div>
                <p className="font-medium">{workingTitle}</p>
                <p className="mt-1 text-sm app-text-muted">{workingDescription}</p>
              </div>
            </div>
          </ChatMessage>
        ) : null}

        {run.failureMessage ? (
          <ChatMessage role="agent">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--app-danger)]" />
              <div>
                <p className="font-medium text-[var(--app-danger)]">Run failed</p>
                <p className="mt-1 text-sm app-text-muted">{run.failureMessage}</p>
              </div>
            </div>
          </ChatMessage>
        ) : null}

        {run.state === 'awaiting_input' ? (
          <ChatMessage role="agent" wide>
            <QuestionPanel run={run} onSubmitAnswers={onSubmitAnswers} isSubmitting={isSubmitting} />
          </ChatMessage>
        ) : null}

        {run.planArtifact ? (
          <ChatMessage role="agent" wide>
            <PlanArtifactPanel
              artifact={run.planArtifact}
              feedback={feedback}
              onFeedbackChange={onFeedbackChange}
              onRequestChanges={onRequestChanges}
              onApprove={onApprove}
              canRequestChanges={hasCapability(run, 'request_changes')}
              canApprove={hasCapability(run, 'approve_plan')}
              isSubmitting={isSubmitting}
            />
          </ChatMessage>
        ) : null}

        {hasCapability(run, 'retry') ? (
          <ChatMessage role="agent">
            <div className="flex flex-wrap gap-3">
              <Button onClick={onRetry} disabled={isSubmitting}>
                <RotateCcw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </ChatMessage>
        ) : null}
      </div>
    </div>
  );
}

// Renders the centered empty state when composing a new run.
function NewPlanEmptyState() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))]">
          <MessageSquareText className="h-6 w-6 text-[var(--app-accent-strong)]" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold">Start with a planning prompt.</h2>
        <p className="mt-2 text-sm leading-6 app-text-muted">
          Pick the board context above, then describe what the agent should plan from the composer below.
        </p>
      </div>
    </div>
  );
}

// Renders one chat bubble with consistent alignment and metadata.
function ChatMessage({
  role,
  timestamp,
  wide = false,
  children,
}: {
  role: 'user' | 'agent';
  timestamp?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('min-w-0', wide ? 'w-full' : 'max-w-[min(42rem,92%)]')}>
        <div className={cn('mb-1 flex items-center gap-2 text-xs app-text-muted', isUser ? 'justify-end' : 'justify-start')}>
          <span>{isUser ? 'You' : 'Agent'}</span>
          {timestamp ? <span>{timestamp}</span> : null}
        </div>
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm leading-6 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.55)]',
            isUser
              ? 'border-[color-mix(in_srgb,var(--app-accent)_36%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel-strong))]'
              : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)]'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// Renders long chat text with ChatGPT-style expand and collapse controls.
function ExpandableMessageContent({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldCollapse = content.length > collapsedMessageLength;
  const visibleContent = shouldCollapse && !isExpanded
    ? `${content.slice(0, collapsedMessageLength).trimEnd()}...`
    : content;

  return (
    <div>
      <p className="whitespace-pre-wrap break-words">{visibleContent}</p>
      {shouldCollapse ? (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-[var(--app-accent-strong)] hover:text-[var(--app-highlight)]"
          onClick={() => setIsExpanded((value) => !value)}
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}

// Renders the sticky contextual composer for new plans and follow-up run messages.
function ChatComposer({
  mode,
  value,
  disabledReason,
  isSubmitting,
  selectedRun,
  canCancel,
  isCanceling,
  onChange,
  onSubmit,
  onCancel,
  onNewPlan,
}: {
  mode: 'create' | 'message';
  value: string;
  disabledReason: string | null;
  isSubmitting: boolean;
  selectedRun: AgentRunDetail | null;
  canCancel: boolean;
  isCanceling: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onNewPlan: () => void;
}) {
  const isMessageMode = mode === 'message';
  const label = isMessageMode ? 'Add context or correction' : 'What should the agent plan?';
  const placeholder = isMessageMode
    ? 'Tell the agent what changed or what it should plan next.'
    : 'Ask the agent to plan a feature, refactor, workflow, or investigation.';
  const canSubmit = value.trim().length > 0 && !isSubmitting && !disabledReason;

  return (
    <form
      className="shrink-0 border-t border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-strong)_95%,transparent)] px-4 py-4 backdrop-blur-xl sm:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      {selectedRun && !isMessageMode ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-3 py-2 text-xs app-text-muted">
          <span>This run is in {stateLabels[selectedRun.state].toLowerCase()} state. Start a new plan to continue prompting.</span>
          <Button size="sm" onClick={onNewPlan}>
            <Plus className="h-4 w-4" />
            New plan
          </Button>
        </div>
      ) : null}

      <div className="mx-auto max-w-4xl">
        <label className="sr-only" htmlFor="agent-chat-composer">
          {label}
        </label>
        <div className="flex items-end gap-3 rounded-[1.25rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_84%,transparent)] p-2 focus-within:border-[color-mix(in_srgb,var(--app-accent)_48%,var(--app-border))]">
          <textarea
            id="agent-chat-composer"
            className="max-h-48 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-6 outline-none placeholder:text-[var(--app-muted)]"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={Boolean(disabledReason)}
          />
          {canCancel ? (
            <Button
              className="shrink-0"
              variant="danger"
              size="icon"
              aria-label="Cancel run"
              disabled={isCanceling}
              onClick={onCancel}
            >
              {isCanceling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            </Button>
          ) : null}
          <Button type="submit" variant="primary" size="icon" disabled={!canSubmit} aria-label={isMessageMode ? 'Send message' : 'Create plan'}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs app-text-muted">
          <span>{disabledReason ?? (isMessageMode ? 'Message the selected run.' : 'Creates a board-scoped planning run.')}</span>
          <span>{isMessageMode ? 'Message' : 'New plan'}</span>
        </div>
      </div>
    </form>
  );
}

// Renders compact status text reused by sidebars and loading states.
function RunStatusCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_72%,transparent)] px-4 py-3 text-sm app-text-muted">
      {label}
    </div>
  );
}

// Renders structured clarification questions as an inline assistant artifact.
function QuestionPanel({
  run,
  onSubmitAnswers,
  isSubmitting,
}: {
  run: AgentRunDetail;
  onSubmitAnswers: (answers: AgentClarificationAnswer[]) => void;
  isSubmitting: boolean;
}) {
  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, AgentClarificationAnswer>>({});
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  useEffect(() => {
    setAnswersByQuestion({});
    setActiveQuestionIndex(0);
  }, [run.id, run.version]);

  const activeQuestion = run.questions[Math.min(activeQuestionIndex, Math.max(run.questions.length - 1, 0))];
  const answers = run.questions.flatMap((question) => {
    const answer = answersByQuestion[question.questionKey];
    return answer?.selectedOptionKey || answer?.selectedOptionKeys?.length ? [answer] : [];
  });
  const canSubmit = answers.length === run.questions.length && run.capabilities.includes('submit_input');
  const answeredCount = answers.length;
  const canGoBack = activeQuestionIndex > 0;
  const canGoForward = activeQuestionIndex < run.questions.length - 1;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <MessageSquareText className="mt-1 h-5 w-5 text-[var(--app-accent)]" />
          <div>
            <p className="app-kicker">Clarification needed</p>
            <h3 className="mt-2 text-xl font-semibold">Answer these decisions to continue.</h3>
          </div>
        </div>
        <Badge>{answeredCount}/{run.questions.length} answered</Badge>
      </div>

      <div className="mt-5">
        {activeQuestion ? (
          <QuestionCard
            question={activeQuestion}
            answer={answersByQuestion[activeQuestion.questionKey]}
            positionLabel={`Question ${activeQuestionIndex + 1} of ${run.questions.length}`}
            onChange={(answer) =>
              setAnswersByQuestion((current) => ({
                ...current,
                [activeQuestion.questionKey]: answer,
              }))
            }
          />
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button type="button" onClick={() => setActiveQuestionIndex((value) => Math.max(0, value - 1))} disabled={!canGoBack || isSubmitting}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button type="button" onClick={() => setActiveQuestionIndex((value) => Math.min(run.questions.length - 1, value + 1))} disabled={!canGoForward || isSubmitting}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="primary"
          onClick={() => onSubmitAnswers(answers)}
          disabled={!canSubmit || isSubmitting}
        >
          <Send className="h-4 w-4" />
          Submit all answers
        </Button>
      </div>
    </div>
  );
}

// Renders the active clarification question with selectable answers and an optional note.
function QuestionCard({
  question,
  answer,
  positionLabel,
  onChange,
}: {
  question: AgentQuestion;
  answer?: AgentClarificationAnswer;
  positionLabel: string;
  onChange: (answer: AgentClarificationAnswer) => void;
}) {
  const selectedOptionKeys = answer?.selectedOptionKeys ?? (answer?.selectedOptionKey ? [answer.selectedOptionKey] : []);
  const selectedOptionKeySet = new Set(selectedOptionKeys);
  const updateSingleAnswer = (optionKey: string) => {
    onChange({
      questionKey: question.questionKey,
      selectedOptionKey: optionKey,
      selectedOptionKeys: [optionKey],
      note: answer?.note ?? null,
    });
  };
  const updateMultiAnswer = (optionKey: string, checked: boolean) => {
    const nextOptionKeys = optionKey === 'none-of-the-above'
      ? checked ? [optionKey] : []
      : checked
        ? [...selectedOptionKeys.filter((key) => key !== 'none-of-the-above'), optionKey]
        : selectedOptionKeys.filter((key) => key !== optionKey);

    onChange({
      questionKey: question.questionKey,
      selectedOptionKey: nextOptionKeys[0] ?? '',
      selectedOptionKeys: nextOptionKeys,
      note: answer?.note ?? null,
    });
  };

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_68%,transparent)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{positionLabel}</Badge>
        <Badge>{question.category.replace(/_/g, ' ')}</Badge>
        {question.blocking ? <Badge variant="danger">Blocking</Badge> : null}
      </div>
      <h4 className="mt-3 text-lg font-semibold">{question.prompt}</h4>
      <p className="mt-2 text-sm app-text-muted">{question.whyThisMatters}</p>

      <div className="mt-4 space-y-2">
        {question.options.map((option) => (
          <label
            key={option.optionKey}
            className="flex cursor-pointer gap-3 rounded-2xl border border-[var(--app-border)] p-3 transition hover:border-[color-mix(in_srgb,var(--app-accent)_32%,var(--app-border))]"
          >
            <input
              className="mt-1"
              type={question.allowMultiple ? 'checkbox' : 'radio'}
              name={question.questionKey}
              checked={selectedOptionKeySet.has(option.optionKey)}
              onChange={(event) => {
                if (question.allowMultiple) {
                  updateMultiAnswer(option.optionKey, event.target.checked);
                } else {
                  updateSingleAnswer(option.optionKey);
                }
              }}
            />
            <span>
              <span className="font-medium">
                {option.label}
                {option.isRecommended ? <span className="ml-2 text-xs text-[var(--app-accent)]">Recommended</span> : null}
              </span>
              <span className="mt-1 block text-sm app-text-muted">{option.description}</span>
            </span>
          </label>
        ))}
      </div>

      <textarea
        className="app-input mt-4 min-h-20 resize-y"
        value={answer?.note ?? ''}
        onChange={(event) =>
          onChange({
            questionKey: question.questionKey,
            selectedOptionKey: selectedOptionKeys[0] ?? '',
            selectedOptionKeys,
            note: event.target.value,
          })
        }
        placeholder="Optional note for the agent"
      />
    </div>
  );
}

// Renders the generated plan artifact and review controls inline in the thread.
function PlanArtifactPanel({
  artifact,
  feedback,
  onFeedbackChange,
  onRequestChanges,
  onApprove,
  canRequestChanges,
  canApprove,
  isSubmitting,
}: {
  artifact: AgentPlanArtifact;
  feedback: string;
  onFeedbackChange: (value: string) => void;
  onRequestChanges: () => void;
  onApprove: () => void;
  canRequestChanges: boolean;
  canApprove: boolean;
  isSubmitting: boolean;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-1 h-5 w-5 text-[var(--app-success)]" />
        <div>
          <p className="app-kicker">Generated plan</p>
          <h3 className="mt-2 text-xl font-semibold">{artifact.objective}</h3>
          <p className="mt-2 app-text-muted">{artifact.summary}</p>
        </div>
      </div>

      <PlanQualityPanel artifact={artifact} />
      <ImplementationDetailsPanel artifact={artifact} />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <PlanList title="In scope" items={artifact.scope.inScope} />
        <PlanList title="Out of scope" items={artifact.scope.outOfScope} />
      </div>
      <PlanList title="Requirements" items={artifact.requirements} />
      <PlanList title="Technical decisions" items={artifact.technicalDecisions.map((decision) => `${decision.area}: ${decision.choice}. ${decision.rationale}`)} />
      <PlanList title="Constraints" items={artifact.constraints} />
      <PlanList title="Success criteria" items={artifact.successCriteria} />

      <div className="mt-6 space-y-4">
        {artifact.implementationPhases.map((phase) => (
          <div key={phase.id} className="rounded-2xl border border-[var(--app-border)] p-4">
            <h4 className="text-lg font-semibold">{phase.title}</h4>
            <p className="mt-1 text-sm app-text-muted">{phase.summary}</p>
            <div className="mt-4 space-y-3">
              {phase.tasks.map((task) => (
                <div key={task.id} className="rounded-xl bg-[color-mix(in_srgb,var(--app-panel-strong)_70%,transparent)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{task.title}</p>
                    <Badge>{task.priority}</Badge>
                  </div>
                  <p className="mt-1 text-sm app-text-muted">{task.description}</p>
                  <PlanList title="Acceptance" items={task.acceptanceCriteria} compact />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <PlanList title="Risks" items={artifact.risks} />
      <PlanList title="Assumptions" items={artifact.assumptions} />
      <PlanList title="Open questions" items={artifact.openQuestions} />
      <PlanList title="Notes" items={artifact.notes} />

      {(canRequestChanges || canApprove) ? (
        <div className="mt-6 border-t border-[var(--app-border)] pt-5">
          {canRequestChanges ? (
            <textarea
              className="app-input min-h-24 resize-y"
              value={feedback}
              onChange={(event) => onFeedbackChange(event.target.value)}
              placeholder="Request a cleaner or more constrained plan..."
            />
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {canRequestChanges ? (
              <Button disabled={feedback.trim().length === 0 || isSubmitting} onClick={onRequestChanges}>
                Request changes
              </Button>
            ) : null}
            {canApprove ? (
              <Button variant="primary" disabled={isSubmitting} onClick={onApprove}>
                <CheckCircle2 className="h-4 w-4" />
                Approve plan
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Renders structured implementation handoff details when the planner includes them.
function ImplementationDetailsPanel({ artifact }: { artifact: AgentPlanArtifact }) {
  const details = artifact.implementationDetails;
  if (!details) return null;

  const sections = [
    ['Data flow', details.dataFlow],
    ['Tooling', details.tooling],
    ['Integrations', details.integrations],
    ['Realtime strategy', details.realtimeStrategy],
    ['Storage and retention', details.storageAndRetention],
    ['Observability', details.observability],
    ['Security and access', details.securityAndAccess],
  ] as const;
  const visibleSections = sections.filter(([, items]) => items.length > 0);
  if (visibleSections.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-strong)_72%,transparent)] p-4">
      <p className="app-kicker">Implementation details</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {visibleSections.map(([title, items]) => (
          <PlanList key={title} title={title} items={items} compact />
        ))}
      </div>
    </div>
  );
}

// Renders plan quality issues near the generated artifact header.
function PlanQualityPanel({ artifact }: { artifact: AgentPlanArtifact }) {
  const quality = artifact.quality;
  if (!quality || quality.issues.length === 0) return null;

  return (
    <div className="mt-5 rounded-xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-strong)_72%,transparent)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[var(--app-warning)]" />
        <p className="text-sm font-semibold">Plan quality review</p>
        <Badge>{quality.score}/100</Badge>
      </div>
      <ul className="mt-3 space-y-2 text-sm app-text-muted">
        {quality.issues.map((issue) => (
          <li key={issue.code}>
            <span className="font-medium text-[var(--app-text)]">{issue.severity === 'error' ? 'Issue' : 'Warning'}:</span> {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Renders a titled list within generated plan sections.
function PlanList({ title, items, compact = false }: { title: string; items: string[]; compact?: boolean }) {
  if (items.length === 0) return null;

  return (
    <div className={compact ? 'mt-3' : 'mt-6'}>
      <p className="app-kicker">{title}</p>
      <ul className="mt-2 space-y-2 text-sm app-text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-accent)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

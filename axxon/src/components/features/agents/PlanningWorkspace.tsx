// Renders the org-level planning workspace for creating and reviewing board-scoped agent runs.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, ClipboardList, GitBranch, Loader2, MessageSquareText, RotateCcw, Send, XCircle } from 'lucide-react';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import PageHero from '@/components/ui/PageHero';
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
} from '@/lib/api/agents/agentRuns';
import { fetchBoards } from '@/lib/api/boards/getBoards';
import type { AgentClarificationAnswer, AgentPlanArtifact, AgentQuestion, AgentRun, AgentRunDetail, AgentRunState } from '@/lib/types/agentTypes';
import type { BoardBaseData } from '@/lib/types/boardTypes';

const activeStates = new Set<AgentRunState>(['queued', 'preparing', 'planning', 'dispatching']);

const stateLabels: Record<AgentRunState, string> = {
  queued: 'Queued',
  preparing: 'Preparing',
  awaiting_input: 'Needs input',
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function hasCapability(run: AgentRunDetail | undefined, capability: string) {
  return Boolean(run?.capabilities.includes(capability as never));
}

function stateBadgeVariant(state: AgentRunState) {
  if (state === 'completed' || state === 'awaiting_plan_review') return 'success' as const;
  if (state === 'failed' || state === 'cancelled') return 'danger' as const;
  return 'default' as const;
}

export default function PlanningWorkspace({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [feedback, setFeedback] = useState('');
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
    if (!selectedRunId && runs.length > 0) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

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
    mutationFn: () => createPlanningAgentRun(organizationId, selectedBoardId!, prompt),
    onSuccess: (run) => {
      setPrompt('');
      setSelectedRunId(run.id);
      refreshAgentQueries(run);
    },
  });

  const inputMutation = useMutation({
    mutationFn: (answers: AgentClarificationAnswer[]) =>
      submitAgentRunInput(organizationId, selectedBoardId!, activeRun!.id, answers),
    onSuccess: refreshAgentQueries,
  });

  const changesMutation = useMutation({
    mutationFn: () => requestAgentRunChanges(organizationId, selectedBoardId!, activeRun!.id, feedback),
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

  const isCreatingDisabled = !selectedBoardId || prompt.trim().length === 0 || createMutation.isPending;

  return (
    <div className="app-page space-y-6">
      <PageHero
        kicker="Agent Planning"
        title="Build a plan with a guided agent loop."
        description="Create a board-scoped planning run, answer only the decisions that matter, and review the generated implementation plan from one focused workspace."
        actions={
          <Badge>
            <Bot className="h-3.5 w-3.5" />
            Realtime planning state
          </Badge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
        <section className="space-y-6">
          <Surface variant="strong" className="rounded-[2rem] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="app-kicker">Board context</p>
                <h2 className="mt-2 text-2xl font-semibold">Select a board</h2>
              </div>
              <GitBranch className="h-5 w-5 app-text-muted" />
            </div>

            <select
              className="app-input mt-5"
              value={selectedBoardId ?? ''}
              disabled={isBoardsLoading || boards.length === 0}
              onChange={(event) => {
                setSelectedBoardId(event.target.value || null);
                setSelectedRunId(null);
              }}
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

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!isCreatingDisabled) createMutation.mutate();
              }}
            >
              <label className="block text-sm font-medium" htmlFor="agent-planning-prompt">
                What should the agent plan?
              </label>
              <textarea
                id="agent-planning-prompt"
                className="app-input min-h-36 resize-y"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: Rebuild the planning UI and wire it to the new agent state machine."
              />
              {createMutation.error ? (
                <p className="text-sm text-[var(--app-danger)]">{createMutation.error.message}</p>
              ) : null}
              <Button type="submit" variant="primary" disabled={isCreatingDisabled}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Create plan
              </Button>
            </form>
          </Surface>

          <Surface variant="strong" className="rounded-[2rem] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Planning runs</p>
                <h2 className="mt-2 text-2xl font-semibold">{selectedBoard?.name ?? 'Board runs'}</h2>
              </div>
              <Badge>{runs.length} runs</Badge>
            </div>

            <div className="mt-5 space-y-3">
              {isRunsLoading ? (
                <RunStatusCard label="Loading runs..." />
              ) : runs.length === 0 ? (
                <RunStatusCard label="No planning runs yet. Create one from the prompt above." />
              ) : (
                runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedRunId === run.id
                        ? 'border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel-strong))]'
                        : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_76%,transparent)] hover:border-[color-mix(in_srgb,var(--app-accent)_30%,var(--app-border))]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{run.title}</p>
                        <p className="mt-1 text-xs app-text-muted">{formatDate(run.updatedAt)}</p>
                      </div>
                      <Badge variant={stateBadgeVariant(run.state)}>{stateLabels[run.state]}</Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Surface>
        </section>

        <Surface variant="strong" className="min-h-[42rem] rounded-[2rem] p-6 sm:p-8">
          {isRunLoading ? (
            <RunStatusCard label="Loading selected run..." />
          ) : activeRun ? (
            <RunDetail
              run={activeRun}
              feedback={feedback}
              onFeedbackChange={setFeedback}
              onSubmitAnswers={(answers) => inputMutation.mutate(answers)}
              onRequestChanges={() => changesMutation.mutate()}
              onApprove={() => approveMutation.mutate()}
              onCancel={() => cancelMutation.mutate()}
              onRetry={() => retryMutation.mutate()}
              isSubmitting={
                inputMutation.isPending ||
                changesMutation.isPending ||
                approveMutation.isPending ||
                cancelMutation.isPending ||
                retryMutation.isPending
              }
              error={
                inputMutation.error?.message ||
                changesMutation.error?.message ||
                approveMutation.error?.message ||
                cancelMutation.error?.message ||
                retryMutation.error?.message ||
                null
              }
            />
          ) : (
            <div className="flex h-full min-h-96 items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--app-border)] p-8 text-center">
              <div>
                <ClipboardList className="mx-auto h-10 w-10 app-text-muted" />
                <h2 className="mt-4 text-2xl font-semibold">Create or select a planning run</h2>
                <p className="mt-2 max-w-md app-text-muted">
                  The generated plan, clarification questions, and review actions will appear here.
                </p>
              </div>
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}

function RunStatusCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_72%,transparent)] px-4 py-3 text-sm app-text-muted">
      {label}
    </div>
  );
}

function RunDetail({
  run,
  feedback,
  onFeedbackChange,
  onSubmitAnswers,
  onRequestChanges,
  onApprove,
  onCancel,
  onRetry,
  isSubmitting,
  error,
}: {
  run: AgentRunDetail;
  feedback: string;
  onFeedbackChange: (value: string) => void;
  onSubmitAnswers: (answers: AgentClarificationAnswer[]) => void;
  onRequestChanges: () => void;
  onApprove: () => void;
  onCancel: () => void;
  onRetry: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="app-kicker">Active run</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{run.title}</h2>
          <p className="mt-2 max-w-2xl app-text-muted">{run.prompt}</p>
        </div>
        <Badge variant={stateBadgeVariant(run.state)}>{stateLabels[run.state]}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Confidence" value={`${Math.round((run.readiness?.confidence ?? 0) * 100)}%`} />
        <MetricCard label="Clarification turns" value={String(run.clarificationTurnCount)} />
        <MetricCard label="Updated" value={formatDate(run.updatedAt)} />
      </div>

      {activeStates.has(run.state) ? (
        <Surface className="rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--app-accent)]" />
            <div>
              <p className="font-medium">Agent is working</p>
              <p className="text-sm app-text-muted">This panel updates when the board receives the next agent-run event.</p>
            </div>
          </div>
        </Surface>
      ) : null}

      {run.failureMessage ? (
        <Surface className="rounded-2xl border-[color-mix(in_srgb,var(--app-danger)_36%,var(--app-border))] p-4">
          <p className="font-medium text-[var(--app-danger)]">Run failed</p>
          <p className="mt-1 text-sm app-text-muted">{run.failureMessage}</p>
        </Surface>
      ) : null}

      {run.state === 'awaiting_input' ? (
        <QuestionPanel run={run} onSubmitAnswers={onSubmitAnswers} isSubmitting={isSubmitting} />
      ) : null}

      {run.planArtifact ? (
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
      ) : null}

      <div className="flex flex-wrap gap-3">
        {hasCapability(run, 'retry') ? (
          <Button onClick={onRetry} disabled={isSubmitting}>
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        ) : null}
        {hasCapability(run, 'cancel') ? (
          <Button variant="danger" onClick={onCancel} disabled={isSubmitting}>
            <XCircle className="h-4 w-4" />
            Cancel
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-[var(--app-danger)]">{error}</p> : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Surface className="rounded-2xl p-4">
      <p className="app-kicker">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </Surface>
  );
}

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

  useEffect(() => {
    setAnswersByQuestion({});
  }, [run.id, run.version]);

  const answers = run.questions.flatMap((question) => {
    const answer = answersByQuestion[question.questionKey];
    return answer?.selectedOptionKey ? [answer] : [];
  });
  const canSubmit = answers.length === run.questions.length && run.capabilities.includes('submit_input');

  return (
    <Surface className="rounded-[1.6rem] p-5">
      <div className="flex items-start gap-3">
        <MessageSquareText className="mt-1 h-5 w-5 text-[var(--app-accent)]" />
        <div>
          <p className="app-kicker">Clarification needed</p>
          <h3 className="mt-2 text-2xl font-semibold">Answer these decisions to continue.</h3>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {run.questions.map((question) => (
          <QuestionCard
            key={question.questionKey}
            question={question}
            answer={answersByQuestion[question.questionKey]}
            onChange={(answer) =>
              setAnswersByQuestion((current) => ({
                ...current,
                [question.questionKey]: answer,
              }))
            }
          />
        ))}
      </div>

      <Button
        className="mt-5"
        variant="primary"
        onClick={() => onSubmitAnswers(answers)}
        disabled={!canSubmit || isSubmitting}
      >
        <Send className="h-4 w-4" />
        Submit answers
      </Button>
    </Surface>
  );
}

function QuestionCard({
  question,
  answer,
  onChange,
}: {
  question: AgentQuestion;
  answer?: AgentClarificationAnswer;
  onChange: (answer: AgentClarificationAnswer) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_68%,transparent)] p-4">
      <div className="flex flex-wrap items-center gap-2">
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
              type="radio"
              name={question.questionKey}
              checked={answer?.selectedOptionKey === option.optionKey}
              onChange={() => onChange({ questionKey: question.questionKey, selectedOptionKey: option.optionKey, note: answer?.note ?? null })}
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
            selectedOptionKey: answer?.selectedOptionKey ?? '',
            note: event.target.value,
          })
        }
        placeholder="Optional note for the agent"
      />
    </div>
  );
}

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
    <Surface className="rounded-[1.6rem] p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-1 h-5 w-5 text-[var(--app-success)]" />
        <div>
          <p className="app-kicker">Generated plan</p>
          <h3 className="mt-2 text-2xl font-semibold">{artifact.objective}</h3>
          <p className="mt-2 app-text-muted">{artifact.summary}</p>
        </div>
      </div>

      <PlanList title="Requirements" items={artifact.requirements} />
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
    </Surface>
  );
}

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

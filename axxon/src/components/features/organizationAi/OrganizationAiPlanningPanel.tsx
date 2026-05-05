// Renders the board-bound planning mode with persisted turn processing, inline status feedback, and a structured plan viewer.
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent, KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDashed,
  FolderKanban,
  LoaderCircle,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  User2,
} from 'lucide-react';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Surface from '@/components/ui/Surface';
import { useSocket } from '@/hooks/useSocket';
import { fetchBoards } from '@/lib/api/boards/getBoards';
import { createOrganizationAiPlanningSession } from '@/lib/api/organizations/createOrganizationAiPlanningSession';
import { createOrganizationAiPlanningSessionMessage } from '@/lib/api/organizations/createOrganizationAiPlanningSessionMessage';
import { fetchOrganizationAiPlanningSession } from '@/lib/api/organizations/getOrganizationAiPlanningSession';
import { fetchOrganizationAiPlanningSessions } from '@/lib/api/organizations/getOrganizationAiPlanningSessions';
import { processOrganizationAiPlanningSession } from '@/lib/api/organizations/processOrganizationAiPlanningSession';
import type { AiRuntimeSummary } from '@/lib/types/aiTypes';
import type { BoardBaseData } from '@/lib/types/boardTypes';
import type {
  PlanningContext,
  PlanningPlanArtifact,
  PlanningQuestion,
  PlanningQuestionAnswerInput,
  PlanningQuestionStatus,
  PlanningReadiness,
  PlanningRun,
  PlanningRunStage,
  PlanningSession,
  PlanningSessionDetail,
  PlanningSessionMessage,
  PlanningSessionState,
} from '@/lib/types/organizationAiPlanningTypes';

const STALE_PROCESSING_AFTER_MS = 35_000;
const DISCONNECTED_POLL_INTERVAL_MS = 5_000;
type PlanningSidebarView = 'overview' | 'implementation' | 'risks';

function parseSelectedBoardId(searchParams: Pick<URLSearchParams, 'get'>) {
  return searchParams.get('boardId');
}

function parseSelectedSessionId(searchParams: Pick<URLSearchParams, 'get'>) {
  const rawValue = searchParams.get('sessionId');
  const parsedValue = rawValue ? Number(rawValue) : null;

  return parsedValue && Number.isFinite(parsedValue) ? parsedValue : null;
}

function getStateLabel(state: PlanningSessionState) {
  switch (state) {
    case 'queued':
      return 'Queued';
    case 'analyzing':
      return 'Analyzing';
    case 'clarifying':
      return 'Clarifying';
    case 'planning':
      return 'Planning';
    case 'plan_generated':
      return 'Plan generated';
    case 'failed':
      return 'Needs retry';
    default:
      return state;
  }
}

function getRunStageLabel(stage: PlanningRunStage) {
  switch (stage) {
    case 'queued':
      return 'Queued';
    case 'analyzing':
      return 'Analyzing';
    case 'clarifying':
      return 'Needs clarification';
    case 'planning':
      return 'Generating plan';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return stage;
  }
}

function getQuestionStatusTone(status: PlanningQuestionStatus) {
  switch (status) {
    case 'answered':
      return 'text-emerald-300';
    case 'superseded':
      return 'text-amber-200';
    default:
      return 'text-cyan-300';
  }
}

function parsePlannerStage(message: PlanningSessionMessage) {
  const metadata = message.metadata_json;

  if (!metadata || typeof metadata !== 'object') {
    return 'analyzing';
  }

  if (
    metadata.stage === 'queued' ||
    metadata.stage === 'clarifying' ||
    metadata.stage === 'planning' ||
    metadata.stage === 'completed' ||
    metadata.stage === 'failed'
  ) {
    return metadata.stage;
  }

  return 'analyzing';
}

function isPlannerStatusRetryable(message: PlanningSessionMessage | null) {
  if (!message || message.message_kind !== 'planner_status') {
    return false;
  }

  const metadata = message.metadata_json;

  if (!metadata || typeof metadata !== 'object') {
    return true;
  }

  return metadata.retryable !== false;
}

function getLatestPlannerStatusMessage(messages: PlanningSessionMessage[]) {
  return [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === 'assistant' && message.message_kind === 'planner_status'
    );
}

function hasPlanningWorkInFlight(detail: PlanningSessionDetail | null) {
  return detail?.activeRun?.state === 'queued' || detail?.activeRun?.state === 'running';
}

function isStaleRun(run: PlanningRun | null | undefined) {
  if (!run) {
    return false;
  }

  return (
    (run.state === 'queued' || run.state === 'running') &&
    Date.now() - new Date(run.updated_at).getTime() >= STALE_PROCESSING_AFTER_MS
  );
}

function upsertPlanningSessionList(
  sessions: PlanningSession[] | undefined,
  nextSession: PlanningSession
) {
  const currentSessions = sessions ?? [];
  const remainingSessions = currentSessions.filter(
    (session) => session.id !== nextSession.id
  );

  return [nextSession, ...remainingSessions];
}

function getLatestOpenClarificationQuestions(questions: PlanningQuestion[]) {
  const openQuestions = questions.filter((question) => question.status === 'open');

  if (openQuestions.length === 0) {
    return [];
  }

  const latestAskedInMessageId = Math.max(
    ...openQuestions.map((question) => question.asked_in_message_id ?? 0)
  );

  return openQuestions
    .filter((question) => (question.asked_in_message_id ?? 0) === latestAskedInMessageId)
    .sort((left, right) => left.id - right.id);
}

function parseClarificationBatchAnswers(message: PlanningSessionMessage) {
  const metadata = message.metadata_json;

  if (!metadata || typeof metadata !== 'object') {
    return [];
  }

  const parsedMetadata = metadata as Record<string, unknown>;

  if (parsedMetadata.submissionMode !== 'clarification_batch') {
    return [];
  }

  return Array.isArray(parsedMetadata.answers)
    ? parsedMetadata.answers.filter(
        (
          answer
        ): answer is {
          note: string | null;
          questionKey: string;
          questionText: string;
          selectedOptionKey: string;
          selectedOptionLabel: string;
        } =>
          Boolean(
            answer &&
              typeof answer === 'object' &&
              typeof (answer as Record<string, unknown>).questionKey === 'string' &&
              typeof (answer as Record<string, unknown>).questionText === 'string' &&
              typeof (answer as Record<string, unknown>).selectedOptionKey === 'string' &&
              typeof (answer as Record<string, unknown>).selectedOptionLabel === 'string'
          )
      )
    : [];
}

function formatTiming(value: number) {
  if (value >= 10_000) {
    return `${Math.round(value / 1_000)}s`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}s`;
  }

  return `${Math.round(value)}ms`;
}

function parsePlannerTimingSummary(message: PlanningSessionMessage) {
  const metadata = message.metadata_json;

  if (!metadata || typeof metadata !== 'object') {
    return [];
  }

  const parsedMetadata = metadata as Record<string, unknown>;
  const timingEntries: string[] = [];

  if (typeof parsedMetadata.analysisDurationMs === 'number') {
    timingEntries.push(`Analysis ${formatTiming(parsedMetadata.analysisDurationMs)}`);
  }

  if (typeof parsedMetadata.planDurationMs === 'number') {
    timingEntries.push(`Plan ${formatTiming(parsedMetadata.planDurationMs)}`);
  }

  if (typeof parsedMetadata.totalDurationMs === 'number') {
    timingEntries.push(`Total ${formatTiming(parsedMetadata.totalDurationMs)}`);
  }

  return timingEntries;
}

function isDevelopmentLikeStage(stage: string) {
  return stage === 'development' || stage === 'staging';
}

function parsePlannerDiagnostics(message: PlanningSessionMessage) {
  const metadata = message.metadata_json;

  if (!metadata || typeof metadata !== 'object') {
    return {
      discardedCandidateQuestions: [],
      failureCode: null,
      validationIssues: [],
    };
  }

  const parsedMetadata = metadata as Record<string, unknown>;
  const failureCode =
    parsedMetadata.failureCode === 'json_parse_failed' ||
    parsedMetadata.failureCode === 'schema_validation_failed'
      ? parsedMetadata.failureCode
      : null;
  const validationIssues = Array.isArray(parsedMetadata.validationIssues)
    ? parsedMetadata.validationIssues.filter(
        (issue): issue is string =>
          typeof issue === 'string' && issue.trim().length > 0
      )
    : [];
  const discardedCandidateQuestions: Array<{
    question: string;
    questionKey: string;
    reason: string;
    source: 'analysis' | 'fallback';
  }> = [];

  if (Array.isArray(parsedMetadata.discardedCandidateQuestions)) {
    for (const candidate of parsedMetadata.discardedCandidateQuestions) {
      if (
        candidate &&
        typeof candidate === 'object' &&
        typeof (candidate as Record<string, unknown>).question === 'string' &&
        typeof (candidate as Record<string, unknown>).questionKey === 'string' &&
        typeof (candidate as Record<string, unknown>).reason === 'string' &&
        (((candidate as Record<string, unknown>).source === 'analysis') ||
          (candidate as Record<string, unknown>).source === 'fallback')
      ) {
        discardedCandidateQuestions.push(candidate as {
          question: string;
          questionKey: string;
          reason: string;
          source: 'analysis' | 'fallback';
        });
      }
    }
  }

  return {
    discardedCandidateQuestions,
    failureCode,
    validationIssues,
  };
}

function getRecommendedOptionKey(options: PlanningQuestion['options_json']) {
  const explicitRecommendedOption = options.find(
    (option) => option.isRecommended && option.optionKey !== 'none-of-the-above'
  );

  if (explicitRecommendedOption) {
    return explicitRecommendedOption.optionKey;
  }

  return options.find((option) => option.optionKey !== 'none-of-the-above')?.optionKey ?? null;
}

function getOrderedQuestionOptions(options: PlanningQuestion['options_json']) {
  const recommendedOptionKey = getRecommendedOptionKey(options);
  const recommendedOptions: PlanningQuestion['options_json'] = [];
  const regularOptions: PlanningQuestion['options_json'] = [];
  const noneOfTheAboveOptions: PlanningQuestion['options_json'] = [];

  for (const option of options) {
    const normalizedOption = {
      ...option,
      isRecommended: option.optionKey === recommendedOptionKey,
    };

    if (option.optionKey === 'none-of-the-above') {
      noneOfTheAboveOptions.push(normalizedOption);
      continue;
    }

    if (normalizedOption.isRecommended) {
      recommendedOptions.push(normalizedOption);
      continue;
    }

    regularOptions.push(normalizedOption);
  }

  return [...recommendedOptions, ...regularOptions, ...noneOfTheAboveOptions];
}

function formatPlanningOptionLabel(option: PlanningQuestion['options_json'][number]) {
  return option.isRecommended ? `${option.label} (Recommended)` : option.label;
}

function PlanningQuestionCard({
  question,
}: {
  question: PlanningQuestion;
}) {
  const orderedOptions = getOrderedQuestionOptions(question.options_json);

  return (
    <Surface variant="default" className="rounded-[1.25rem] border border-[var(--app-border)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{question.category.replace(/_/g, ' ')}</Badge>
        <Badge>{question.is_blocking ? 'Blocking' : 'Optional'}</Badge>
        {question.is_required ? <Badge>Required</Badge> : null}
        <span className={`text-xs font-medium ${getQuestionStatusTone(question.status)}`}>
          {question.status}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6">{question.question_text}</p>
      <p className="mt-2 text-sm leading-6 app-text-muted">{question.why_this_matters}</p>
      {orderedOptions.length > 0 ? (
        <div className="mt-4 space-y-2">
          {orderedOptions.map((option) => {
            const isSelected = option.optionKey === question.selected_option_key;

            return (
              <div
                key={option.optionKey}
                className={`rounded-[1rem] border px-3 py-2 ${
                  isSelected
                    ? 'border-[color-mix(in_srgb,var(--app-accent)_32%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel-strong))]'
                    : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_72%,transparent)]'
                }`}
              >
                <p className="text-sm font-medium">{formatPlanningOptionLabel(option)}</p>
                <p className="mt-1 text-xs leading-5 app-text-muted">{option.description}</p>
              </div>
            );
          })}
        </div>
      ) : null}
      {question.answer_note ? (
        <p className="mt-3 text-sm leading-6 app-text-muted">
          Note: {question.answer_note}
        </p>
      ) : null}
    </Surface>
  );
}

function PlanningConversationMessage({
  message,
  questions,
  activeClarificationMessageId,
  activeClarificationQuestions,
  isClarificationDisabled,
  isClarificationSubmitting,
  onClarificationSubmit,
  showDiagnostics,
}: {
  message: PlanningSessionMessage;
  questions: PlanningQuestion[];
  activeClarificationMessageId: number | null;
  activeClarificationQuestions: PlanningQuestion[];
  isClarificationDisabled: boolean;
  isClarificationSubmitting: boolean;
  onClarificationSubmit: (answers: PlanningQuestionAnswerInput[]) => Promise<void>;
  showDiagnostics: boolean;
}) {
  const messageQuestions = questions.filter(
    (question) => question.asked_in_message_id === message.id
  );
  const clarificationBatchAnswers = parseClarificationBatchAnswers(message);
  const plannerDiagnostics = parsePlannerDiagnostics(message);
  const plannerTimingSummary = parsePlannerTimingSummary(message);
  const isPlannerStatusMessage =
    message.role === 'assistant' && message.message_kind === 'planner_status';
  const isClarificationBatchMessage =
    message.role === 'user' && clarificationBatchAnswers.length > 0;
  const plannerStage = parsePlannerStage(message);
  const isWorkingMessage =
    isPlannerStatusMessage &&
    (message.status === 'pending' || message.status === 'processing');
  const showActiveClarificationStepper =
    message.message_kind === 'clarification_questions' &&
    activeClarificationMessageId === message.id &&
    activeClarificationQuestions.length > 0;

  return (
    <div
      className={`flex ${
        message.role === 'user' ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`max-w-3xl rounded-[1.5rem] border px-4 py-3 sm:px-5 ${
          message.role === 'user'
            ? 'border-[color-mix(in_srgb,var(--app-accent)_28%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel-strong))]'
            : message.status === 'failed'
              ? 'border-[color-mix(in_srgb,#f43f5e_32%,var(--app-border))] bg-[color-mix(in_srgb,#f43f5e_10%,var(--app-panel-soft))]'
              : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_78%,transparent)]'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
              message.role === 'user'
                ? 'bg-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] text-[var(--app-accent-foreground)]'
                : 'bg-[color-mix(in_srgb,var(--app-highlight)_14%,transparent)] text-[var(--app-highlight)]'
            }`}
          >
            {message.role === 'user' ? (
              <User2 className="h-4 w-4" />
            ) : isWorkingMessage ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">
                {message.role === 'user' ? 'You' : 'Axxon Planner'}
              </p>
              <span className="text-xs app-text-muted">
                {message.message_kind.replace(/_/g, ' ')}
              </span>
              {isPlannerStatusMessage ? (
                <Badge>{getRunStageLabel(plannerStage)}</Badge>
              ) : null}
              {message.status === 'failed' ? (
                <span className="text-xs font-medium text-rose-300">Needs follow-up</span>
              ) : null}
            </div>

            {isClarificationBatchMessage ? (
              <p className="mt-2 text-sm font-medium app-text-muted">
                {clarificationBatchAnswers.length === 1
                  ? 'Submitted clarification answer.'
                  : `Submitted ${clarificationBatchAnswers.length} clarification answers.`}
              </p>
            ) : message.role === 'user' || isPlannerStatusMessage ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
                {message.content}
              </p>
            ) : (
              <MarkdownRenderer content={message.content} className="mt-2 break-words" />
            )}

            {plannerTimingSummary.length > 0 ? (
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] app-text-muted">
                {plannerTimingSummary.join(' · ')}
              </p>
            ) : null}

            {showDiagnostics &&
            isPlannerStatusMessage &&
            message.status === 'failed' &&
            (plannerDiagnostics.failureCode ||
              plannerDiagnostics.validationIssues.length > 0 ||
              plannerDiagnostics.discardedCandidateQuestions.length > 0) ? (
              <Surface
                variant="default"
                className="mt-4 rounded-[1.1rem] border border-[color-mix(in_srgb,#f43f5e_24%,var(--app-border))] p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] app-text-muted">
                  Planner diagnostics
                </p>
                {plannerDiagnostics.failureCode ? (
                  <p className="mt-2 text-sm leading-6">
                    Failure code: {plannerDiagnostics.failureCode}
                  </p>
                ) : null}
                {plannerDiagnostics.validationIssues.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm leading-6 app-text-muted">
                    {plannerDiagnostics.validationIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
                {plannerDiagnostics.discardedCandidateQuestions.length > 0 ? (
                  <div className="mt-3 space-y-2 text-sm leading-6 app-text-muted">
                    {plannerDiagnostics.discardedCandidateQuestions.map((candidate) => (
                      <p
                        key={`${candidate.source}-${candidate.questionKey}-${candidate.reason}`}
                      >
                        {candidate.source}: {candidate.question} ({candidate.reason})
                      </p>
                    ))}
                  </div>
                ) : null}
              </Surface>
            ) : null}

            {clarificationBatchAnswers.length > 0 ? (
              <div className="mt-4 space-y-3">
                {clarificationBatchAnswers.map((answer) => (
                  (() => {
                    const question = questions.find(
                      (candidateQuestion) =>
                        candidateQuestion.question_key === answer.questionKey
                    );
                    const selectedOption = question
                      ? getOrderedQuestionOptions(question.options_json).find(
                          (option) => option.optionKey === answer.selectedOptionKey
                        )
                      : null;

                    return (
                      <Surface
                        key={`${message.id}-${answer.questionKey}`}
                        variant="default"
                        className="rounded-[1.1rem] border border-[var(--app-border)] p-3"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] app-text-muted">
                          Question
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-6">
                          {answer.questionText}
                        </p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] app-text-muted">
                          Answer
                        </p>
                        <p className="mt-2 text-sm font-medium leading-6">
                          {selectedOption
                            ? formatPlanningOptionLabel(selectedOption)
                            : answer.selectedOptionLabel}
                        </p>
                        {answer.note ? (
                          <p className="mt-3 text-sm leading-6 app-text-muted">
                            Note: {answer.note}
                          </p>
                        ) : null}
                      </Surface>
                    );
                  })()
                ))}
              </div>
            ) : null}

            {showActiveClarificationStepper ? (
              <div className="mt-4">
                <PlanningClarificationStepper
                  questions={activeClarificationQuestions}
                  isDisabled={isClarificationDisabled}
                  isSubmitting={isClarificationSubmitting}
                  onSubmit={onClarificationSubmit}
                />
              </div>
            ) : null}

            {messageQuestions.length > 0 && !showActiveClarificationStepper ? (
              <div className="mt-4 space-y-3">
                {messageQuestions.map((question) => (
                  <PlanningQuestionCard key={question.id} question={question} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanningClarificationStepper({
  isDisabled,
  questions,
  isSubmitting,
  onSubmit,
}: {
  isDisabled: boolean;
  questions: PlanningQuestion[];
  isSubmitting: boolean;
  onSubmit: (answers: PlanningQuestionAnswerInput[]) => Promise<void>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [answersByQuestionKey, setAnswersByQuestionKey] = useState<
    Record<string, { note: string; selectedOptionKey: string }>
  >({});
  const activeQuestion = questions[activeIndex] ?? null;
  const activeAnswer = activeQuestion
    ? answersByQuestionKey[activeQuestion.question_key]
    : undefined;
  const orderedOptions = activeQuestion
    ? getOrderedQuestionOptions(activeQuestion.options_json)
    : [];
  const isLastQuestion = activeIndex === questions.length - 1;
  const canAdvance = Boolean(activeQuestion && activeAnswer?.selectedOptionKey);
  const isInputDisabled = isSubmitting || isDisabled;

  useEffect(() => {
    setAnswersByQuestionKey((currentAnswers) => {
      const nextAnswers: Record<string, { note: string; selectedOptionKey: string }> = {};

      for (const question of questions) {
        const existingAnswer = currentAnswers[question.question_key];

        nextAnswers[question.question_key] = {
          note: existingAnswer?.note ?? '',
          selectedOptionKey: existingAnswer?.selectedOptionKey ?? '',
        };
      }

      return nextAnswers;
    });
    setActiveIndex((currentIndex) =>
      questions.length === 0 ? 0 : Math.min(currentIndex, questions.length - 1)
    );
  }, [questions]);

  if (!activeQuestion) {
    return null;
  }

  return (
    <Surface variant="default" className="rounded-[1.35rem] border border-[var(--app-border)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="app-kicker">Clarification Card</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">
            Question {activeIndex + 1} of {questions.length}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{activeQuestion.category.replace(/_/g, ' ')}</Badge>
          <Badge>{activeQuestion.is_blocking ? 'Blocking' : 'Optional'}</Badge>
        </div>
      </div>

      <p className="mt-4 text-lg font-semibold leading-7">{activeQuestion.question_text}</p>
      <p className="mt-3 text-sm leading-6 app-text-muted">
        {activeQuestion.why_this_matters}
      </p>

      <div className="mt-5 space-y-3">
        {orderedOptions.map((option) => {
          const isSelected = activeAnswer?.selectedOptionKey === option.optionKey;

          return (
            <button
              key={option.optionKey}
              type="button"
              disabled={isInputDisabled}
              onClick={() =>
                setAnswersByQuestionKey((currentAnswers) => ({
                  ...currentAnswers,
                  [activeQuestion.question_key]: {
                    note: currentAnswers[activeQuestion.question_key]?.note ?? '',
                    selectedOptionKey: option.optionKey,
                  },
                }))
              }
            className={`w-full rounded-[1.2rem] border px-4 py-3 text-left transition ${
                isSelected
                  ? 'border-[color-mix(in_srgb,var(--app-accent)_32%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel-strong))]'
                  : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_78%,transparent)] hover:border-[var(--app-border-strong)]'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <p className="text-sm font-semibold">{formatPlanningOptionLabel(option)}</p>
              <p className="mt-2 text-sm leading-6 app-text-muted">{option.description}</p>
            </button>
          );
        })}
      </div>

      <label className="mt-5 block">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] app-text-muted">
          Optional note
        </span>
        <textarea
          rows={4}
          value={activeAnswer?.note ?? ''}
          disabled={isInputDisabled}
          onChange={(event) =>
            setAnswersByQuestionKey((currentAnswers) => ({
              ...currentAnswers,
              [activeQuestion.question_key]: {
                note: event.target.value,
                selectedOptionKey:
                  currentAnswers[activeQuestion.question_key]?.selectedOptionKey ?? '',
              },
            }))
          }
          placeholder="Add extra context if the selected option needs it."
          className="mt-3 w-full resize-none rounded-[1.3rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_80%,transparent)] px-4 py-3 text-sm leading-7 text-[var(--app-foreground)] outline-none focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          disabled={isInputDisabled || activeIndex === 0}
          onClick={() => setActiveIndex((currentIndex) => Math.max(0, currentIndex - 1))}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Button
          variant="primary"
          disabled={!canAdvance || isInputDisabled}
          onClick={async () => {
            if (!canAdvance) {
              return;
            }

            if (!isLastQuestion) {
              setActiveIndex((currentIndex) =>
                Math.min(questions.length - 1, currentIndex + 1)
              );
              return;
            }

            await onSubmit(
              questions.map((question) => ({
                questionKey: question.question_key,
                selectedOptionKey:
                  answersByQuestionKey[question.question_key]?.selectedOptionKey ?? '',
                note: answersByQuestionKey[question.question_key]?.note?.trim() || null,
              }))
            );
          }}
        >
          {isSubmitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : isLastQuestion ? (
            <Send className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {isLastQuestion ? 'Submit answers' : 'Next question'}
        </Button>
      </div>
    </Surface>
  );
}

function PlanningReadinessCard({
  readiness,
  state,
  activeRun,
}: {
  readiness: PlanningReadiness;
  state: PlanningSessionState;
  activeRun: PlanningRun | null;
}) {
  return (
    <Surface variant="default" className="rounded-[1.6rem] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="app-kicker">Planner Status</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">
            {getStateLabel(state)}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {activeRun ? <Badge>{getRunStageLabel(activeRun.stage)}</Badge> : null}
          <Badge>{Math.round(readiness.confidence * 100)}% confidence</Badge>
          <Badge>{readiness.recommendedNextAction.replace(/_/g, ' ')}</Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Surface variant="default" className="rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.2em] app-text-muted">Objective</p>
          <p className="mt-2 text-sm">{readiness.objectiveClear ? 'Clear' : 'Needs work'}</p>
        </Surface>
        <Surface variant="default" className="rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.2em] app-text-muted">Scope</p>
          <p className="mt-2 text-sm">{readiness.scopeBounded ? 'Bounded' : 'Unbounded'}</p>
        </Surface>
        <Surface variant="default" className="rounded-2xl p-4">
          <p className="text-xs uppercase tracking-[0.2em] app-text-muted">Acceptance</p>
          <p className="mt-2 text-sm">
            {readiness.hasAcceptanceCriteria ? 'Present' : 'Missing'}
          </p>
        </Surface>
      </div>
      <ul className="mt-4 space-y-2 text-sm leading-6 app-text-muted">
        {readiness.reasonSummary.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </Surface>
  );
}

function PlanningContextSection({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <Surface variant="default" className="rounded-[1.4rem] p-4">
      <p className="text-xs uppercase tracking-[0.2em] app-text-muted">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 app-text-muted">{emptyLabel}</p>
      )}
    </Surface>
  );
}

function PlanningTechnicalDecisionSection({
  decisions,
  emptyLabel,
  title = 'Technical Decisions',
}: {
  decisions: PlanningContext['technicalDecisions'] | PlanningPlanArtifact['technicalDecisions'];
  emptyLabel: string;
  title?: string;
}) {
  const normalizedDecisions = decisions ?? [];

  return (
    <Surface variant="default" className="rounded-[1.4rem] p-4">
      <p className="text-xs uppercase tracking-[0.2em] app-text-muted">{title}</p>
      {normalizedDecisions.length > 0 ? (
        <div className="mt-3 space-y-3">
          {normalizedDecisions.map((decision) => (
            <div key={`${decision.area}-${decision.choice}`} className="rounded-[1rem] border border-[var(--app-border)] px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{decision.area}</p>
                <Badge>{decision.source}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6">{decision.choice}</p>
              <p className="mt-2 text-xs leading-5 app-text-muted">{decision.rationale}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 app-text-muted">{emptyLabel}</p>
      )}
    </Surface>
  );
}

function PlanningPhaseStack({
  plan,
}: {
  plan: PlanningPlanArtifact;
}) {
  return (
    <div className="space-y-3">
      {plan.implementationPhases.map((phase, index) => (
        <details
          key={phase.id}
          open={index === 0}
          className="rounded-[1.4rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_78%,transparent)]"
        >
          <summary className="cursor-pointer list-none px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{phase.title}</p>
                <p className="mt-2 text-sm leading-6 app-text-muted">{phase.summary}</p>
              </div>
              <Badge>{phase.tasks.length} tasks</Badge>
            </div>
          </summary>
          <div className="space-y-3 border-t border-[var(--app-border)] px-4 py-4">
            {phase.tasks.map((task) => (
              <Surface key={task.id} variant="default" className="rounded-[1.1rem] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{task.title}</p>
                  <Badge>{task.type}</Badge>
                  <Badge>{task.priority}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 app-text-muted">{task.description}</p>
                {task.dependencyIds.length > 0 ? (
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] app-text-muted">
                    Dependencies: {task.dependencyIds.join(', ')}
                  </p>
                ) : null}
                {task.acceptanceCriteria.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm leading-6">
                    {task.acceptanceCriteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                ) : null}
              </Surface>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function PlanningContextPanel({
  context,
  readiness,
  state,
  questions,
  activeRun,
}: {
  context: PlanningContext;
  readiness: PlanningReadiness;
  state: PlanningSessionState;
  questions: PlanningQuestion[];
  activeRun: PlanningRun | null;
}) {
  const [view, setView] = useState<PlanningSidebarView>('overview');
  const unresolvedQuestions = questions.filter((question) => question.status === 'open');

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PlanningReadinessCard readiness={readiness} state={state} activeRun={activeRun} />

      <SegmentedControl
        value={view}
        onChange={setView}
        ariaLabel="Planning side panel"
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'implementation', label: 'Implementation' },
          { value: 'risks', label: 'Risks' },
        ]}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {view === 'overview' ? (
          <>
            <Surface variant="default" className="rounded-[1.6rem] p-5">
              <p className="app-kicker">Current Understanding</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">
                {context.objective ?? 'Objective still being clarified'}
              </h3>
              <p className="mt-3 text-sm leading-6 app-text-muted">
                {context.summary ?? 'The planner is still extracting a concise summary from the conversation.'}
              </p>
            </Surface>

            <div className="grid gap-4 xl:grid-cols-2">
              <PlanningContextSection
                title="In Scope"
                items={context.inScope}
                emptyLabel="No explicit in-scope items yet."
              />
              <PlanningContextSection
                title="Out Of Scope"
                items={context.outOfScope}
                emptyLabel="No out-of-scope boundaries captured yet."
              />
              <PlanningContextSection
                title="Known Requirements"
                items={context.knownRequirements}
                emptyLabel="Requirements will appear here after analysis."
              />
              <PlanningContextSection
                title="Acceptance Criteria"
                items={context.acceptanceCriteria}
                emptyLabel="Acceptance criteria are still being inferred."
              />
              <PlanningContextSection
                title="Constraints"
                items={context.constraints}
                emptyLabel="No explicit constraints captured yet."
              />
              <PlanningContextSection
                title="Dependencies"
                items={context.dependencies}
                emptyLabel="No dependencies captured yet."
              />
            </div>

            <PlanningTechnicalDecisionSection
              decisions={context.technicalDecisions}
              emptyLabel="No concrete technical defaults have been captured yet."
            />
          </>
        ) : null}

        {view === 'implementation' ? (
          <>
            <PlanningContextSection
              title="Affected Areas"
              items={context.affectedAreas}
              emptyLabel="Affected system areas will appear here."
            />
            {unresolvedQuestions.length > 0 ? (
              <Surface variant="default" className="rounded-[1.6rem] p-5">
                <p className="app-kicker">Open Questions</p>
                <div className="mt-4 space-y-3">
                  {unresolvedQuestions.map((question) => (
                    <PlanningQuestionCard key={question.id} question={question} />
                  ))}
                </div>
              </Surface>
            ) : (
              <PlanningContextSection
                title="Open Questions"
                items={[]}
                emptyLabel="No open clarification questions right now."
              />
            )}
          </>
        ) : null}

        {view === 'risks' ? (
          <>
            <PlanningContextSection
              title="Blocking Unknowns"
              items={readiness.blockingUnknowns}
              emptyLabel="No blocking unknowns remain."
            />
            <PlanningContextSection
              title="Risks"
              items={context.risks}
              emptyLabel="No risks called out yet."
            />
            <PlanningContextSection
              title="Unresolved Unknowns"
              items={readiness.unresolvedUnknowns}
              emptyLabel="No unresolved unknowns remain."
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function PlanningPlanViewer({
  plan,
  activeRun,
}: {
  plan: PlanningPlanArtifact;
  activeRun: PlanningRun | null;
}) {
  const [view, setView] = useState<PlanningSidebarView>('overview');

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Surface variant="default" className="rounded-[1.6rem] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-kicker">Structured Plan</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              {plan.objective}
            </h3>
          </div>
          <Badge>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Plan generated
          </Badge>
        </div>
        <p className="mt-3 text-sm leading-6 app-text-muted">{plan.summary}</p>
        {activeRun ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{getRunStageLabel(activeRun.stage)}</Badge>
            <Badge>Attempt {Math.max(activeRun.attempt_count, 1)}</Badge>
          </div>
        ) : null}
      </Surface>

      <SegmentedControl
        value={view}
        onChange={setView}
        ariaLabel="Structured plan sections"
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'implementation', label: 'Implementation' },
          { value: 'risks', label: 'Risks' },
        ]}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {view === 'overview' ? (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              <PlanningContextSection
                title="In Scope"
                items={plan.scope.inScope}
                emptyLabel="No in-scope items were captured."
              />
              <PlanningContextSection
                title="Out Of Scope"
                items={plan.scope.outOfScope}
                emptyLabel="No explicit out-of-scope items were captured."
              />
              <PlanningContextSection
                title="Assumptions"
                items={plan.assumptions}
                emptyLabel="No assumptions listed."
              />
              <PlanningContextSection
                title="Constraints"
                items={plan.constraints}
                emptyLabel="No constraints listed."
              />
              <PlanningContextSection
                title="Affected Areas"
                items={plan.affectedAreas}
                emptyLabel="No affected areas listed."
              />
              <PlanningContextSection
                title="Success Criteria"
                items={plan.successCriteria}
                emptyLabel="No success criteria listed."
              />
            </div>

            <PlanningTechnicalDecisionSection
              decisions={plan.technicalDecisions}
              emptyLabel="No concrete technical decisions were recorded."
            />
          </>
        ) : null}

        {view === 'implementation' ? (
          <PlanningPhaseStack plan={plan} />
        ) : null}

        {view === 'risks' ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <PlanningContextSection
              title="Risks"
              items={plan.risks}
              emptyLabel="No risks listed."
            />
            <PlanningContextSection
              title="Open Questions"
              items={plan.openQuestions}
              emptyLabel="No open questions remain."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function OrganizationAiPlanningPanel({
  organizationId,
  runtime,
}: {
  organizationId: string;
  runtime: AiRuntimeSummary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const socketRef = useSocket(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const processingSessionIdRef = useRef<number | null>(null);
  const startProcessingSessionRef = useRef(
    async (_boardId: string, _sessionId: number) => undefined
  );
  const [draft, setDraft] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPersisting, setIsPersisting] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [processingSessionId, setProcessingSessionId] = useState<number | null>(null);
  const [activeDetail, setActiveDetail] = useState<PlanningSessionDetail | null>(null);
  const showPlannerDiagnostics = useMemo(
    () => isDevelopmentLikeStage(runtime.stage),
    [runtime.stage]
  );
  const selectedBoardId = useMemo(
    () => parseSelectedBoardId(searchParams),
    [searchParams]
  );
  const selectedSessionId = useMemo(
    () => parseSelectedSessionId(searchParams),
    [searchParams]
  );

  const { data: boards = [], isLoading: isBoardsLoading } = useQuery<BoardBaseData[]>({
    queryKey: ['boards', organizationId],
    queryFn: () => fetchBoards(organizationId),
  });
  const {
    data: sessions = [],
    isLoading: isSessionsLoading,
    error: sessionsError,
  } = useQuery<PlanningSession[]>({
    queryKey: ['organization-ai-planning-sessions', organizationId, selectedBoardId],
    queryFn: () =>
      fetchOrganizationAiPlanningSessions(organizationId, selectedBoardId!),
    enabled: Boolean(selectedBoardId),
  });
  const {
    data: selectedSessionData,
    isLoading: isSelectedSessionLoading,
    error: selectedSessionError,
  } = useQuery<PlanningSessionDetail>({
    queryKey: [
      'organization-ai-planning-session',
      organizationId,
      selectedBoardId,
      selectedSessionId,
    ],
    queryFn: () =>
      fetchOrganizationAiPlanningSession(
        organizationId,
        selectedBoardId!,
        selectedSessionId!
      ),
    enabled: Boolean(selectedBoardId && selectedSessionId),
    refetchInterval: (query) =>
      !isSocketConnected &&
      hasPlanningWorkInFlight((query.state.data as PlanningSessionDetail | undefined) ?? null)
        ? DISCONNECTED_POLL_INTERVAL_MS
        : false,
  });

  useEffect(() => {
    if (selectedSessionData) {
      setActiveDetail(selectedSessionData);
      return;
    }

    if (!selectedSessionId) {
      setActiveDetail(null);
    }
  }, [selectedSessionData, selectedSessionId]);

  useEffect(() => {
    const transcriptElement = transcriptRef.current;

    if (!transcriptElement) {
      return;
    }

    transcriptElement.scrollTop = transcriptElement.scrollHeight;
  }, [activeDetail?.messages]);

  const setPlanningParams = ({
    boardId,
    sessionId,
    replace = false,
  }: {
    boardId: string | null;
    sessionId?: number | null;
    replace?: boolean;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', 'planning');

    if (boardId) {
      params.set('boardId', boardId);
    } else {
      params.delete('boardId');
    }

    if (typeof sessionId === 'number') {
      params.set('sessionId', String(sessionId));
    } else {
      params.delete('sessionId');
    }

    params.delete('threadId');

    const nextUrl = `${pathname}?${params.toString()}`;

    if (replace) {
      router.replace(nextUrl, { scroll: false });
      return;
    }

    router.push(nextUrl, { scroll: false });
  };

  const selectedBoard =
    boards.find((board) => String(board.id) === selectedBoardId) ?? null;
  const currentDetail = activeDetail;
  const currentMessages = currentDetail?.messages ?? [];
  const currentQuestions = currentDetail?.questions ?? [];
  const activeClarificationQuestions = getLatestOpenClarificationQuestions(
    currentQuestions
  );
  const activeClarificationMessageId =
    activeClarificationQuestions[0]?.asked_in_message_id ?? null;
  const latestPlannerStatusMessage = getLatestPlannerStatusMessage(currentMessages) ?? null;
  const planningReady = runtime.planningReady ?? runtime.available;
  const activeRun = currentDetail?.activeRun ?? null;
  const isProcessingSelectedSession =
    typeof selectedSessionId === 'number' && processingSessionId === selectedSessionId;
  const sessionHasWorkInFlight = hasPlanningWorkInFlight(currentDetail);
  const hasActiveClarificationBatch = activeClarificationQuestions.length > 0;
  const canSend =
    planningReady &&
    Boolean(selectedBoardId) &&
    draft.trim().length > 0 &&
    !hasActiveClarificationBatch &&
    !isPersisting &&
    !isSelectedSessionLoading &&
    !sessionHasWorkInFlight &&
    !isProcessingSelectedSession;
  const canRetry =
    planningReady &&
    Boolean(selectedBoardId && selectedSessionId) &&
    activeRun?.state === 'failed' &&
    isPlannerStatusRetryable(latestPlannerStatusMessage) &&
    !isPersisting &&
    !isProcessingSelectedSession;

  const syncPlanningCache = useCallback((detail: PlanningSessionDetail) => {
    const boardId = String(detail.session.board_id);

    queryClient.setQueryData(
      [
        'organization-ai-planning-session',
        organizationId,
        boardId,
        detail.session.id,
      ],
      detail
    );
    queryClient.setQueryData<PlanningSession[]>(
      ['organization-ai-planning-sessions', organizationId, boardId],
      (currentSessions) => upsertPlanningSessionList(currentSessions, detail.session)
    );
  }, [organizationId, queryClient]);

  const invalidatePlanningQueries = useCallback((boardId: string, sessionId?: number) => {
    void queryClient.invalidateQueries({
      queryKey: ['organization-ai-planning-sessions', organizationId, boardId],
    });

    if (typeof sessionId === 'number') {
      void queryClient.invalidateQueries({
        queryKey: [
          'organization-ai-planning-session',
          organizationId,
          boardId,
          sessionId,
        ],
      });
    }
  }, [organizationId, queryClient]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    setIsSocketConnected(socket.connected);

    const handlePlanningSessionUpdated = (detail: PlanningSessionDetail) => {
      if (!detail || typeof detail !== 'object' || !('session' in detail)) {
        return;
      }

      syncPlanningCache(detail);

      if (selectedSessionId === detail.session.id) {
        setActiveDetail(detail);
      }
    };
    const handleConnect = () => {
      setIsSocketConnected(true);

      if (!selectedBoardId) {
        return;
      }

      invalidatePlanningQueries(selectedBoardId, selectedSessionId ?? undefined);
    };
    const handleDisconnect = () => {
      setIsSocketConnected(false);
    };

    socket.on('planning:session:updated', handlePlanningSessionUpdated);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('planning:session:updated', handlePlanningSessionUpdated);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [invalidatePlanningQueries, selectedBoardId, selectedSessionId, socketRef, syncPlanningCache]);

  startProcessingSessionRef.current = async (boardId: string, sessionId: number) => {
    if (processingSessionIdRef.current === sessionId) {
      return;
    }

    processingSessionIdRef.current = sessionId;
    setProcessingSessionId(sessionId);

    try {
      const detail = await processOrganizationAiPlanningSession({
        organizationId,
        boardId,
        sessionId,
      });

      syncPlanningCache(detail);
      setActiveDetail(detail);
      invalidatePlanningQueries(boardId, sessionId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to requeue planning session'
      );
      invalidatePlanningQueries(boardId, sessionId);
    } finally {
      if (processingSessionIdRef.current === sessionId) {
        processingSessionIdRef.current = null;
      }

      setProcessingSessionId((currentSessionId) =>
        currentSessionId === sessionId ? null : currentSessionId
      );
    }
  };

  useEffect(() => {
    if (!selectedBoardId || !selectedSessionId || !currentDetail) {
      return;
    }

    if (isStaleRun(currentDetail.activeRun)) {
      void startProcessingSessionRef.current(selectedBoardId, selectedSessionId);
    }
  }, [currentDetail, selectedBoardId, selectedSessionId]);

  const handleBoardChange = (nextBoardId: string) => {
    setDraft('');
    setErrorMessage('');
    setActiveDetail(null);
    setPlanningParams({
      boardId: nextBoardId || null,
      sessionId: null,
    });
  };

  const startNewPlanningSession = () => {
    setDraft('');
    setErrorMessage('');
    setActiveDetail(null);
    setPlanningParams({
      boardId: selectedBoardId,
      sessionId: null,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSend || !selectedBoardId) {
      return;
    }

    const trimmedDraft = draft.trim();

    setDraft('');
    setErrorMessage('');
    setIsPersisting(true);

    try {
      const response = selectedSessionId
        ? await createOrganizationAiPlanningSessionMessage({
            organizationId,
            boardId: selectedBoardId,
            sessionId: selectedSessionId,
            mode: 'freeform',
            content: trimmedDraft,
          })
        : await createOrganizationAiPlanningSession({
            organizationId,
            boardId: selectedBoardId,
            content: trimmedDraft,
          });

      syncPlanningCache(response);
      setActiveDetail(response);

      if (selectedSessionId !== response.session.id) {
        setPlanningParams({
          boardId: selectedBoardId,
          sessionId: response.session.id,
          replace: true,
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to update the planning session'
      );
    } finally {
      setIsPersisting(false);
    }
  };

  const handleClarificationBatchSubmit = async (
    answers: PlanningQuestionAnswerInput[]
  ) => {
    if (!selectedBoardId || !selectedSessionId) {
      return;
    }

    if (!planningReady) {
      setErrorMessage(
        runtime.planningStatusLabel ||
          'Planning mode requires GPU-backed local Ollama before it can continue.'
      );
      return;
    }

    setErrorMessage('');
    setIsPersisting(true);

    try {
      const response = await createOrganizationAiPlanningSessionMessage({
        organizationId,
        boardId: selectedBoardId,
        sessionId: selectedSessionId,
        mode: 'clarification_batch',
        answers,
      });

      syncPlanningCache(response);
      setActiveDetail(response);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to update the planning session'
      );
    } finally {
      setIsPersisting(false);
    }
  };

  const handleRetry = () => {
    if (!selectedBoardId || !selectedSessionId) {
      return;
    }

    setErrorMessage('');
    void startProcessingSessionRef.current(selectedBoardId, selectedSessionId);
  };

  const handleComposerKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <Surface variant="strong" className="overflow-hidden rounded-[2rem]">
      <div className="flex min-h-[720px] flex-col xl:grid xl:min-h-[720px] xl:h-[78vh] xl:grid-cols-[320px_minmax(0,1.05fr)_minmax(320px,0.95fr)] xl:grid-rows-[minmax(0,1fr)]">
        <aside className="border-b border-[var(--app-border)] xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden xl:border-b-0 xl:border-r">
          <div className="border-b border-[var(--app-border)] px-5 py-4 sm:px-6 xl:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Planning Mode</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Board planning sessions
                </h2>
                <p className="mt-2 text-sm leading-6 app-text-muted">
                  Planning sessions stay board-bound so the clarification loop, scope, and final plan all stay anchored to one workspace.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={startNewPlanningSession}
                disabled={!selectedBoardId || isPersisting}
              >
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-hidden">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] app-text-muted">
                Board
              </span>
              <select
                value={selectedBoardId ?? ''}
                onChange={(event) => handleBoardChange(event.target.value)}
                className="mt-3 w-full rounded-[1.1rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_88%,transparent)] px-4 py-3 text-sm outline-none focus:border-[var(--app-border-strong)]"
              >
                <option value="">
                  {isBoardsLoading ? 'Loading boards...' : 'Select a board'}
                </option>
                {boards.map((board) => (
                  <option key={board.id} value={String(board.id)}>
                    {board.name}
                  </option>
                ))}
              </select>
            </label>

            {!selectedBoardId ? (
              <Surface variant="default" className="rounded-[1.4rem] p-4">
                <p className="text-sm leading-6 app-text-muted">
                  Select a board before starting planning mode. The general assistant remains available without board scope in the Assistant tab.
                </p>
              </Surface>
            ) : null}

            {sessionsError instanceof Error ? (
              <Surface variant="default" className="rounded-[1.4rem] p-4 text-sm text-rose-300">
                {sessionsError.message}
              </Surface>
            ) : null}

            {selectedBoardId ? (
              <div className="space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                {isSessionsLoading ? (
                  <Surface variant="default" className="rounded-[1.4rem] p-4">
                    <p className="text-sm app-text-muted">Loading planning sessions...</p>
                  </Surface>
                ) : null}

                {!isSessionsLoading && sessions.length === 0 ? (
                  <Surface variant="default" className="rounded-[1.4rem] p-4">
                    <p className="text-sm leading-6 app-text-muted">
                      The first planning prompt for this board will create a saved planning session here.
                    </p>
                  </Surface>
                ) : null}

                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() =>
                      setPlanningParams({
                        boardId: selectedBoardId,
                        sessionId: session.id,
                      })
                    }
                    className={`w-full rounded-[1.25rem] border px-4 py-3 text-left transition ${
                      selectedSessionId === session.id
                        ? 'border-[color-mix(in_srgb,var(--app-accent)_32%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel-strong))]'
                        : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_78%,transparent)] hover:border-[var(--app-border-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{session.title}</p>
                      <Badge>{getStateLabel(session.planner_state)}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 app-text-muted">
                      {session.summary || 'Planning session'}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0 border-b border-[var(--app-border)] xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4 sm:px-6">
            <div>
              <p className="app-kicker">
                {selectedBoard ? `Board: ${selectedBoard.name}` : 'Planning Workspace'}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {currentDetail?.session.title ??
                  (selectedBoard ? 'New planning session' : 'Select a board to begin')}
              </h2>
              <p className="mt-2 text-sm leading-6 app-text-muted">
                {currentDetail?.session.summary ??
                  (selectedBoard
                    ? 'Describe the feature, answer targeted clarification questions, and receive a structured implementation plan.'
                    : 'Planning mode is board-bound so the resulting scope and task structure stay anchored to one board.')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge>
                <FolderKanban className="h-3.5 w-3.5" />
                {selectedBoard?.name ?? 'Board required'}
              </Badge>
              <Badge>
                <Sparkles className="h-3.5 w-3.5" />
                {runtime.providerLabel}
              </Badge>
              {runtime.accelerationState ? (
                <Badge>{runtime.accelerationState.toUpperCase()}</Badge>
              ) : null}
              {currentDetail ? <Badge>{getStateLabel(currentDetail.session.planner_state)}</Badge> : null}
              {activeRun ? <Badge>{getRunStageLabel(activeRun.stage)}</Badge> : null}
              {!isSocketConnected && selectedSessionId ? <Badge>Polling fallback</Badge> : null}
              {canRetry ? (
                <Button variant="ghost" onClick={handleRetry}>
                  <RotateCcw className="h-4 w-4" />
                  Retry
                </Button>
              ) : null}
            </div>
          </div>

          <div
            ref={transcriptRef}
            className="min-h-[380px] space-y-4 overflow-y-auto px-4 py-5 sm:px-6 xl:min-h-0 xl:flex-1"
          >
            {!selectedBoardId ? (
              <Surface variant="default" className="rounded-[1.6rem] p-6">
                <p className="app-kicker">Planning Empty State</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">
                  Pick a board before starting planning mode
                </h3>
                <p className="mt-3 text-sm leading-7 app-text-muted">
                  Good starting prompts: &quot;Plan the next analytics dashboard phase&quot;, &quot;Break down the sprint planning workspace polish&quot;, or &quot;Scope the next GitHub integration milestone.&quot;
                </p>
              </Surface>
            ) : null}

            {selectedSessionId && isSelectedSessionLoading && !currentDetail ? (
              <Surface variant="default" className="rounded-[1.6rem] p-6">
                <p className="app-kicker">Loading Session</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">
                  Rehydrating planning session...
                </h3>
              </Surface>
            ) : null}

            {selectedSessionError instanceof Error ? (
              <Surface variant="default" className="rounded-[1.6rem] p-6 text-sm text-rose-300">
                {selectedSessionError.message}
              </Surface>
            ) : null}

            {selectedBoardId && !currentDetail ? (
              <Surface variant="default" className="rounded-[1.6rem] p-6">
                <p className="app-kicker">Planning Empty State</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">
                  Start the next planning session
                </h3>
                <p className="mt-3 text-sm leading-7 app-text-muted">
                  The planner will gather missing requirements, keep track of unresolved unknowns, and generate a structured plan once the request is bounded enough.
                </p>
              </Surface>
            ) : null}

            {currentMessages.map((message) => (
              <PlanningConversationMessage
                key={`${message.id}-${message.sequence_number}`}
                message={message}
                questions={currentQuestions}
                activeClarificationMessageId={activeClarificationMessageId}
                activeClarificationQuestions={activeClarificationQuestions}
                isClarificationDisabled={!planningReady}
                isClarificationSubmitting={isPersisting}
                onClarificationSubmit={handleClarificationBatchSubmit}
                showDiagnostics={showPlannerDiagnostics}
              />
            ))}
          </div>

          {errorMessage ? (
            <div className="border-t border-[var(--app-border)] px-5 py-3 text-sm text-rose-300 sm:px-6 xl:shrink-0">
              {errorMessage}
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="border-t border-[var(--app-border)] px-4 py-4 sm:px-6 xl:shrink-0"
          >
            <label className="block">
              <span className="sr-only">Planning message</span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={
                  !planningReady
                    ? runtime.planningStatusLabel ||
                      'Planning mode requires GPU-backed local Ollama before it can run.'
                    : !selectedBoardId
                      ? 'Select a board to begin planning mode.'
                      : selectedSessionId
                        ? 'Refine the scope or add another planning turn...'
                        : 'Describe the feature, task, or initiative you want planned...'
                }
                disabled={
                  !planningReady ||
                  isPersisting ||
                  !selectedBoardId ||
                  isSelectedSessionLoading ||
                  sessionHasWorkInFlight ||
                  isProcessingSelectedSession ||
                  hasActiveClarificationBatch
                }
                rows={5}
                className="w-full resize-none rounded-[1.6rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_80%,transparent)] px-4 py-3 text-sm leading-7 text-[var(--app-foreground)] outline-none focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm app-text-muted">
                {!planningReady
                  ? runtime.planningStatusLabel ||
                    'Planning mode is waiting for a GPU-backed local runtime.'
                  : hasActiveClarificationBatch
                    ? 'Answer the active clarification card in the transcript above to continue.'
                    : !isSocketConnected && sessionHasWorkInFlight
                      ? 'Socket disconnected. Polling the latest planning run state until realtime reconnects.'
                    : sessionHasWorkInFlight || isProcessingSelectedSession
                      ? 'The planner is processing the current turn. You can send the next reply once this step finishes.'
                      : 'Press Enter to send. Use Shift+Enter for a newline.'}
              </p>

              <Button variant="primary" type="submit" disabled={!canSend}>
                {isPersisting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {selectedSessionId ? 'Send Reply' : 'Start Planning'}
              </Button>
            </div>
          </form>
        </div>

        <div className="min-w-0 px-4 py-5 sm:px-6 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
          {currentDetail ? (
            currentDetail.planArtifact ? (
              <PlanningPlanViewer plan={currentDetail.planArtifact} activeRun={currentDetail.activeRun} />
            ) : (
              <PlanningContextPanel
                context={currentDetail.context}
                readiness={currentDetail.readiness}
                state={currentDetail.session.planner_state}
                questions={currentDetail.questions}
                activeRun={currentDetail.activeRun}
              />
            )
          ) : (
            <Surface variant="default" className="rounded-[1.6rem] p-6">
              <div className="flex items-center gap-3">
                <CircleDashed className="h-5 w-5 app-text-muted" />
                <div>
                  <p className="app-kicker">Live Planning State</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">
                    The planner state will appear here
                  </h3>
                </div>
              </div>
              <p className="mt-3 text-sm leading-7 app-text-muted">
                Once a planning session starts, this panel will show the current objective, scope boundaries, acceptance criteria, unresolved unknowns, and the final structured plan artifact.
              </p>
            </Surface>
          )}
        </div>
      </div>
    </Surface>
  );
}

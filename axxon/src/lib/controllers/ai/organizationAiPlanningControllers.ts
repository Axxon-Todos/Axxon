// Orchestrates board-bound AI planning sessions with persisted turn processing, clarification loops, and structured plans.
import { z } from 'zod';

import { resolveDefaultPlanningExecutorKind, resolvePlanningExecutor } from '@/lib/ai/planningExecutors';
import { enqueuePlanningRun } from '@/lib/ai/planningRunQueue';
import {
  StructuredAiResponseError,
  type StructuredAiFailureCode,
} from '@/lib/ai/service';
import db from '@/lib/db/db';
import { PlanningSessionMessages } from '@/lib/models/planningSessionMessages';
import { PlanningSessionQuestions } from '@/lib/models/planningSessionQuestions';
import { PlanningRuns } from '@/lib/models/planningRuns';
import { PlanningSessions } from '@/lib/models/planningSessions';
import type {
  PlanningContext,
  PlanningExecutorKind,
  PlanningPlanArtifact,
  PlanningQuestionCategory,
  PlanningQuestion,
  PlanningQuestionAnswerInput,
  PlanningQuestionCandidate,
  PlanningQuestionOption,
  PlanningReadiness,
  PlanningRun,
  PlanningRunStage,
  PlanningSession,
  PlanningSessionClarificationBatchRequest,
  PlanningSessionCreateRequest,
  PlanningSessionDetail,
  PlanningSessionMessage,
  PlanningSessionMessageRequest,
  PlanningTurnAnalysis,
} from '@/lib/types/organizationAiPlanningTypes';
import { BadRequestError } from '@/lib/utils/apiErrors';
import {
  requireBoardInOrganization,
  requirePlanningSessionCreator,
} from '@/lib/utils/authorization';
import { publishUserUpdate } from '@/lib/wsServer';

const planningSessionCreateSchema = z.object({
  content: z.string().trim().min(1).max(6000),
});

const CLARIFICATION_TURN_LIMIT = 5;
const MAX_QUESTIONS_PER_TURN = 3;
const MAX_CONTEXT_OBJECTIVE_LENGTH = 500;
const MAX_PLANNER_ANSWER_NOTE_LENGTH = 500;
const READINESS_CONFIDENCE_THRESHOLD = 0.7;
const PROCESSING_STALE_AFTER_MS = 30_000;
const NONE_OF_THE_ABOVE_OPTION: PlanningQuestionOption = {
  optionKey: 'none-of-the-above',
  label: 'None of the above',
  description: 'The right answer is not listed; add a note if needed.',
  isRecommended: false,
};

const planningSessionMessageSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('freeform'),
    content: z.string().trim().min(1).max(6000),
  }),
  z.object({
    mode: z.literal('clarification_batch'),
    answers: z
      .array(
        z.object({
          questionKey: z.string().trim().min(1).max(80),
          selectedOptionKey: z.string().trim().min(1).max(80),
          note: z.string().trim().max(1200).nullable().optional(),
        })
      )
      .min(1)
      .max(MAX_QUESTIONS_PER_TURN),
  }),
]);

type PlanningSessionRecord = PlanningSession & {
  context_json: PlanningContext;
  readiness_json: PlanningReadiness;
  plan_artifact_json: PlanningPlanArtifact | null;
};

type ClarificationQuestionSelectionSource = 'analysis' | 'fallback';

type DiscardedClarificationCandidate = {
  question: string;
  questionKey: string;
  reason: string;
  source: ClarificationQuestionSelectionSource;
};

type PlannerStatusMetadata = {
  analysisDurationMs?: number;
  discardedCandidateQuestions?: DiscardedClarificationCandidate[];
  error?: string;
  failureCode?: StructuredAiFailureCode;
  phaseCount?: number;
  planDurationMs?: number;
  questionKeys?: string[];
  responseExcerpt?: string;
  retryable?: boolean;
  startedAt?: string;
  stage?: PlanningRunStage;
  totalDurationMs?: number;
  userMessageId?: number;
  validationIssues?: string[];
};

function createEmptyPlanningContext(): PlanningContext {
  return {
    objective: null,
    summary: null,
    targetOutcome: null,
    inScope: [],
    outOfScope: [],
    assumptions: [],
    constraints: [],
    acceptanceCriteria: [],
    knownRequirements: [],
    unresolvedUnknowns: [],
    blockingUnknowns: [],
    affectedAreas: [],
    risks: [],
    dependencies: [],
    technicalDecisions: [],
    estimatedComplexity: null,
    planningConfidence: 0,
  };
}

function createInitialPlanningReadiness(): PlanningReadiness {
  return {
    objectiveClear: false,
    scopeBounded: false,
    hasAcceptanceCriteria: false,
    knownRequirements: [],
    unresolvedUnknowns: [],
    blockingUnknowns: [],
    confidence: 0,
    recommendedNextAction: 'ask_clarification',
    reasonSummary: ['Waiting for the first planning analysis.'],
  };
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value));
}

function dedupeStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      continue;
    }

    const loweredValue = normalizedValue.toLowerCase();
    const normalizedPlaceholderValue = loweredValue.replace(/\.+$/g, '');

    if (
      normalizedPlaceholderValue === 'none' ||
      normalizedPlaceholderValue === 'n/a' ||
      normalizedPlaceholderValue === 'not applicable' ||
      normalizedPlaceholderValue === 'no known blocking unknowns' ||
      normalizedPlaceholderValue === 'no known blocking unknowns at this stage' ||
      normalizedPlaceholderValue === 'no blocking unknowns' ||
      normalizedPlaceholderValue === 'no blocking unknowns remain' ||
      normalizedPlaceholderValue === 'no known unresolved unknowns' ||
      normalizedPlaceholderValue === 'no known unresolved unknowns at this stage' ||
      normalizedPlaceholderValue === 'no unresolved unknowns' ||
      normalizedPlaceholderValue === 'no unresolved unknowns remain'
    ) {
      continue;
    }

    if (seen.has(loweredValue)) {
      continue;
    }

    seen.add(loweredValue);
    result.push(normalizedValue);
  }

  return result;
}

function dedupeTechnicalDecisions(
  values: Array<
    NonNullable<PlanningContext['technicalDecisions']>[number] | null | undefined
  >
) {
  const seen = new Set<string>();
  const result: PlanningContext['technicalDecisions'] = [];

  for (const value of values) {
    const area = value?.area?.trim();
    const choice = value?.choice?.trim();
    const rationale = value?.rationale?.trim();

    if (!area || !choice || !rationale || !value?.source) {
      continue;
    }

    const key = `${area.toLowerCase()}::${choice.toLowerCase()}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      area,
      choice,
      rationale,
      source: value.source,
    });
  }

  return result;
}

function normalizeQuestionKey(value: string) {
  const trimmedValue = value.trim().toLowerCase();
  const slug = trimmedValue
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'clarification-question';
}

function normalizeQuestionText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeQuestionOptionKey(value: string) {
  return normalizeQuestionKey(value);
}

function normalizeQuestionOptionLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeQuestionOptions(options: PlanningQuestionOption[]) {
  const normalizedOptions: PlanningQuestionOption[] = [];
  const seenKeys = new Set<string>();
  const seenLabels = new Set<string>();
  let recommendedOptionKey: string | null = null;

  for (const option of options) {
    const optionKey = normalizeQuestionOptionKey(option.optionKey || option.label);
    const label = normalizeQuestionOptionLabel(option.label);
    const description = option.description.trim();

    if (
      !optionKey ||
      !label ||
      !description ||
      optionKey === NONE_OF_THE_ABOVE_OPTION.optionKey
    ) {
      continue;
    }

    const normalizedLabel = label.toLowerCase();

    if (seenKeys.has(optionKey) || seenLabels.has(normalizedLabel)) {
      continue;
    }

    seenKeys.add(optionKey);
    seenLabels.add(normalizedLabel);
    normalizedOptions.push({
      optionKey,
      label,
      description,
      isRecommended: option.isRecommended === true,
    });

    if (option.isRecommended === true && !recommendedOptionKey) {
      recommendedOptionKey = optionKey;
    }
  }

  const trimmedOptions = normalizedOptions.slice(0, 3);
  const resolvedRecommendedOptionKey =
    trimmedOptions.find((option) => option.optionKey === recommendedOptionKey)?.optionKey ??
    trimmedOptions[0]?.optionKey ??
    null;

  return [
    ...trimmedOptions.map((option) => ({
      ...option,
      isRecommended: option.optionKey === resolvedRecommendedOptionKey,
    })),
    NONE_OF_THE_ABOVE_OPTION,
  ];
}

function createClarificationCandidate({
  questionKey,
  question,
  category,
  whyThisMatters,
  options,
  required = true,
  blocking = true,
}: {
  questionKey: string;
  question: string;
  category: PlanningQuestionCategory;
  whyThisMatters: string;
  options: PlanningQuestionOption[];
  required?: boolean;
  blocking?: boolean;
}): PlanningQuestionCandidate {
  return {
    questionKey,
    question,
    category,
    whyThisMatters,
    options,
    required,
    blocking,
  };
}

function withQuestionMark(value: string) {
  const trimmedValue = value.trim().replace(/[?]+$/g, '');
  return trimmedValue ? `${toSentenceCase(trimmedValue)}?` : 'Clarify this decision?';
}

function inferClarificationCategoryFromUnknown(
  unknown: string
): PlanningQuestionCategory {
  const normalizedUnknown = unknown.trim().toLowerCase();

  if (
    /deploy|hosting|host|infrastructure|runtime|environment|rollout|cluster|kubernetes|container/.test(
      normalizedUnknown
    )
  ) {
    return 'rollout';
  }

  if (/source|provider|api|dataset|dependency|integration|data/.test(normalizedUnknown)) {
    return 'dependencies';
  }

  if (/auth|permission|role|tenant|user|security/.test(normalizedUnknown)) {
    return 'technical';
  }

  if (/refresh|realtime|real-time|latency|stream|websocket|poll/.test(normalizedUnknown)) {
    return 'technical';
  }

  if (/chart|dashboard|visual|ux|ui|workflow|screen|page/.test(normalizedUnknown)) {
    return 'ux';
  }

  if (/constraint|budget|deadline|compliance|limit/.test(normalizedUnknown)) {
    return 'constraints';
  }

  if (/priority|phase|timeline|milestone/.test(normalizedUnknown)) {
    return 'priority';
  }

  return 'scope';
}

function buildHeuristicUnknownQuestionText(unknown: string) {
  const normalizedUnknown = unknown.trim();
  const normalizedPrefix = normalizedUnknown.toLowerCase();

  if (/^(which|what|where|how|when)\b/.test(normalizedPrefix)) {
    return withQuestionMark(normalizedUnknown);
  }

  return withQuestionMark(
    `What should we choose for ${normalizedUnknown.toLowerCase()} in the first release`
  );
}

function buildHeuristicUnknownOptions(
  unknown: string,
  category: PlanningQuestionCategory
): PlanningQuestionOption[] {
  const normalizedUnknown = unknown.trim().toLowerCase();

  if (
    category === 'rollout' ||
    /deploy|hosting|host|runtime|environment|cluster|kubernetes|container/.test(
      normalizedUnknown
    )
  ) {
    return [
      {
        optionKey: 'single-host',
        label: 'Single host',
        description: 'Start on one managed host or VM to minimize operational complexity.',
        isRecommended: true,
      },
      {
        optionKey: 'container-platform',
        label: 'Container platform',
        description: 'Deploy the first version into an existing Docker or Kubernetes environment.',
      },
      {
        optionKey: 'local-lab',
        label: 'Local lab',
        description: 'Run the first version locally or in a lab environment before hosted rollout.',
      },
    ];
  }

  if (
    category === 'dependencies' ||
    /source|provider|api|dataset|integration|data/.test(normalizedUnknown)
  ) {
    return [
      {
        optionKey: 'existing-system',
        label: 'Existing system',
        description: 'Reuse an internal or already-approved data source first.',
        isRecommended: true,
      },
      {
        optionKey: 'third-party-service',
        label: 'Third-party service',
        description: 'Use a managed external API or provider for the first release.',
      },
      {
        optionKey: 'sample-seed-data',
        label: 'Sample data',
        description: 'Start with mocked or seeded data so the workflow can be validated quickly.',
      },
    ];
  }

  if (
    category === 'technical' &&
    /refresh|realtime|real-time|latency|stream|websocket|poll/.test(normalizedUnknown)
  ) {
    return [
      {
        optionKey: 'polling',
        label: 'Polling',
        description: 'Use periodic refreshes first to reduce implementation complexity.',
        isRecommended: true,
      },
      {
        optionKey: 'server-sent-events',
        label: 'Server-Sent Events',
        description: 'Use one-way streaming updates for near-realtime visibility.',
      },
      {
        optionKey: 'websockets',
        label: 'WebSockets',
        description: 'Use bidirectional realtime updates from the start.',
      },
    ];
  }

  if (
    category === 'technical' &&
    /auth|permission|role|tenant|user|security/.test(normalizedUnknown)
  ) {
    return [
      {
        optionKey: 'single-team',
        label: 'Single team',
        description: 'Support one internal team first with a simple permission model.',
        isRecommended: true,
      },
      {
        optionKey: 'org-sso',
        label: 'Org SSO',
        description: 'Integrate with organization identity and role-based access immediately.',
      },
      {
        optionKey: 'multi-tenant',
        label: 'Multi-tenant',
        description: 'Design the first release for shared, multi-tenant access from the start.',
      },
    ];
  }

  if (
    category === 'ux' ||
    /chart|dashboard|visual|ux|ui|workflow|screen|page/.test(normalizedUnknown)
  ) {
    return [
      {
        optionKey: 'simple-dashboard',
        label: 'Simple dashboard',
        description: 'Start with a straightforward dashboard and minimal interaction.',
        isRecommended: true,
      },
      {
        optionKey: 'interactive-visual',
        label: 'Interactive visual',
        description: 'Prioritize a richer interactive visualization in the first release.',
      },
      {
        optionKey: 'external-tooling',
        label: 'External tooling',
        description: 'Lean on existing observability or dashboard tooling for the first release.',
      },
    ];
  }

  return [
    {
      optionKey: 'pragmatic-v1',
      label: 'Pragmatic V1',
      description: 'Choose the lowest-complexity default that unblocks a usable first release.',
      isRecommended: true,
    },
    {
      optionKey: 'flexible-foundation',
      label: 'Flexible foundation',
      description: 'Add an abstraction layer now so the underlying choice can change later.',
    },
    {
      optionKey: 'scale-first',
      label: 'Scale first',
      description: 'Optimize the first release for the long-term target even if it adds complexity.',
    },
  ];
}

function buildHeuristicUnknownClarificationCandidate(unknown: string) {
  const category = inferClarificationCategoryFromUnknown(unknown);

  return createClarificationCandidate({
    questionKey: normalizeQuestionKey(unknown),
    question: buildHeuristicUnknownQuestionText(unknown),
    category,
    whyThisMatters:
      'This decision needs a concrete default before the implementation plan can be trusted.',
    options: buildHeuristicUnknownOptions(unknown, category),
  });
}

function buildScopeBoundaryClarificationCandidate() {
  return createClarificationCandidate({
    questionKey: 'first-release-boundary',
    question: 'What should the first release boundary be?',
    category: 'scope',
    whyThisMatters:
      'A tighter first-release boundary keeps the implementation plan realistic and sequenced.',
    options: [
      {
        optionKey: 'focused-mvp',
        label: 'Focused MVP',
        description: 'Ship one core workflow with only the minimum supporting pieces.',
        isRecommended: true,
      },
      {
        optionKey: 'balanced-v1',
        label: 'Balanced V1',
        description: 'Ship the core workflow plus a few supporting capabilities in the first release.',
      },
      {
        optionKey: 'broad-platform',
        label: 'Broad platform',
        description: 'Build several major capabilities in the first release even if it increases scope.',
      },
    ],
  });
}

function buildAcceptanceCriteriaClarificationCandidate() {
  return createClarificationCandidate({
    questionKey: 'first-release-success-bar',
    question: 'What should count as success for the first release?',
    category: 'acceptance_criteria',
    whyThisMatters:
      'The plan needs a clear success bar so it can choose the right amount of build and polish.',
    options: [
      {
        optionKey: 'end-to-end-demo',
        label: 'End-to-end demo',
        description: 'The first release should prove the core workflow works from input to output.',
        isRecommended: true,
      },
      {
        optionKey: 'production-ready-slice',
        label: 'Production-ready slice',
        description: 'The first release should be stable, observable, and ready for real operators.',
      },
      {
        optionKey: 'exploratory-prototype',
        label: 'Exploratory prototype',
        description: 'The first release should validate the concept and UX before hardening.',
      },
    ],
  });
}

function buildObjectiveClarificationCandidate() {
  return createClarificationCandidate({
    questionKey: 'primary-outcome',
    question: 'Which primary outcome matters most for the first release?',
    category: 'priority',
    whyThisMatters:
      'The implementation plan needs one dominant outcome so it can prioritize tradeoffs correctly.',
    options: [
      {
        optionKey: 'working-core-workflow',
        label: 'Working core workflow',
        description: 'Prove the main workflow works end to end before optimizing around it.',
        isRecommended: true,
      },
      {
        optionKey: 'operator-visibility',
        label: 'Operator visibility',
        description: 'Prioritize dashboards, observability, and decision-making visibility first.',
      },
      {
        optionKey: 'platform-foundation',
        label: 'Platform foundation',
        description: 'Prioritize a reusable technical foundation that future capabilities can build on.',
      },
    ],
  });
}

function buildFallbackPlanningDirectionClarificationCandidate() {
  return createClarificationCandidate({
    questionKey: 'planning-direction',
    question: 'What should this first implementation plan optimize for?',
    category: 'priority',
    whyThisMatters:
      'The planner still needs one concrete direction before it can turn the request into phased work.',
    options: [
      {
        optionKey: 'fastest-usable-slice',
        label: 'Fastest usable slice',
        description: 'Optimize for the smallest useful release that can be built quickly.',
        isRecommended: true,
      },
      {
        optionKey: 'balanced-foundation',
        label: 'Balanced foundation',
        description: 'Balance delivery speed with enough architecture to support the next phase cleanly.',
      },
      {
        optionKey: 'long-term-architecture',
        label: 'Long-term architecture',
        description: 'Optimize for the long-term system shape even if the first release is slower.',
      },
    ],
  });
}

function buildHeuristicClarificationQuestions({
  readiness,
}: {
  readiness: PlanningReadiness;
}) {
  const heuristicQuestions: PlanningQuestionCandidate[] = [];
  const unknowns = dedupeStrings([
    ...readiness.blockingUnknowns,
    ...readiness.unresolvedUnknowns,
  ]);

  for (const unknown of unknowns) {
    if (heuristicQuestions.length >= MAX_QUESTIONS_PER_TURN) {
      break;
    }

    heuristicQuestions.push(buildHeuristicUnknownClarificationCandidate(unknown));
  }

  if (!readiness.scopeBounded && heuristicQuestions.length < MAX_QUESTIONS_PER_TURN) {
    heuristicQuestions.push(buildScopeBoundaryClarificationCandidate());
  }

  if (
    !readiness.hasAcceptanceCriteria &&
    heuristicQuestions.length < MAX_QUESTIONS_PER_TURN
  ) {
    heuristicQuestions.push(buildAcceptanceCriteriaClarificationCandidate());
  }

  if (!readiness.objectiveClear && heuristicQuestions.length < MAX_QUESTIONS_PER_TURN) {
    heuristicQuestions.push(buildObjectiveClarificationCandidate());
  }

  if (heuristicQuestions.length === 0) {
    heuristicQuestions.push(buildFallbackPlanningDirectionClarificationCandidate());
  }

  return heuristicQuestions.slice(0, MAX_QUESTIONS_PER_TURN);
}

function buildUniqueClarificationQuestionKey(
  baseQuestionKey: string,
  seenQuestionKeys: Set<string>
) {
  const normalizedBaseQuestionKey = normalizeQuestionKey(baseQuestionKey);
  let nextQuestionKey = normalizedBaseQuestionKey;
  let suffix = 2;

  while (seenQuestionKeys.has(nextQuestionKey)) {
    nextQuestionKey = normalizeQuestionKey(`${normalizedBaseQuestionKey}-${suffix}`);
    suffix += 1;
  }

  return nextQuestionKey;
}

function buildUniqueClarificationQuestionText(
  baseQuestionText: string,
  seenQuestionTexts: Set<string>
) {
  const normalizedBaseQuestionText = normalizeQuestionText(baseQuestionText);

  if (!seenQuestionTexts.has(normalizedBaseQuestionText)) {
    return baseQuestionText;
  }

  const trimmedBaseQuestionText = baseQuestionText.trim().replace(/[?]+$/g, '');
  let suffix = 2;
  let nextQuestionText = withQuestionMark(
    `${trimmedBaseQuestionText} in the next implementation step`
  );

  while (seenQuestionTexts.has(normalizeQuestionText(nextQuestionText))) {
    nextQuestionText = withQuestionMark(
      `${trimmedBaseQuestionText} in the next implementation step ${suffix}`
    );
    suffix += 1;
  }

  return nextQuestionText;
}

function buildLastResortClarificationQuestion({
  existingQuestions,
  readiness,
}: {
  existingQuestions: PlanningQuestion[];
  readiness: PlanningReadiness;
}) {
  const seenQuestionKeys = new Set(
    existingQuestions.map((question) => normalizeQuestionKey(question.question_key))
  );
  const seenQuestionTexts = new Set(
    existingQuestions.map((question) => normalizeQuestionText(question.question_text))
  );
  const fallbackCandidates = [
    ...buildHeuristicClarificationQuestions({ readiness }),
    buildFallbackPlanningDirectionClarificationCandidate(),
  ];

  for (const candidate of fallbackCandidates) {
    const normalizedOptions = normalizeQuestionOptions(candidate.options);

    if (normalizedOptions.length !== 4) {
      continue;
    }

    return {
      ...candidate,
      options: normalizedOptions,
      questionKey: buildUniqueClarificationQuestionKey(
        candidate.questionKey || candidate.question,
        seenQuestionKeys
      ),
      question: buildUniqueClarificationQuestionText(
        candidate.question.trim(),
        seenQuestionTexts
      ),
      whyThisMatters: candidate.whyThisMatters.trim(),
    };
  }

  return createClarificationCandidate({
    questionKey: buildUniqueClarificationQuestionKey(
      'planning-direction',
      seenQuestionKeys
    ),
    question: buildUniqueClarificationQuestionText(
      'What should this first implementation plan optimize for?',
      seenQuestionTexts
    ),
    category: 'priority',
    whyThisMatters:
      'The planner still needs one concrete direction before it can turn the request into phased work.',
    options: normalizeQuestionOptions(
      buildFallbackPlanningDirectionClarificationCandidate().options
    ),
  });
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

function groupOpenClarificationQuestionsByBatch(questions: PlanningQuestion[]) {
  const openQuestions = questions.filter((question) => question.status === 'open');
  const groupedQuestions = new Map<number, PlanningQuestion[]>();

  for (const question of openQuestions) {
    const askedInMessageId = question.asked_in_message_id ?? 0;
    const batchQuestions = groupedQuestions.get(askedInMessageId) ?? [];

    batchQuestions.push(question);
    groupedQuestions.set(askedInMessageId, batchQuestions);
  }

  return [...groupedQuestions.entries()]
    .sort(([leftAskedInMessageId], [rightAskedInMessageId]) => rightAskedInMessageId - leftAskedInMessageId)
    .map(([, batchQuestions]) => batchQuestions.sort((left, right) => left.id - right.id));
}

function resolveClarificationBatchForAnswers({
  answers,
  questions,
}: {
  answers: PlanningSessionClarificationBatchRequest['answers'];
  questions: PlanningQuestion[];
}) {
  const openQuestionBatches = groupOpenClarificationQuestionsByBatch(questions);

  if (openQuestionBatches.length === 0) {
    return [];
  }

  const normalizedAnswerKeys = answers
    .map((answer) => normalizeQuestionKey(answer.questionKey))
    .sort();
  const matchingBatch = openQuestionBatches.find((batchQuestions) => {
    if (batchQuestions.length !== normalizedAnswerKeys.length) {
      return false;
    }

    const batchQuestionKeys = batchQuestions
      .map((question) => normalizeQuestionKey(question.question_key))
      .sort();

    return batchQuestionKeys.every(
      (questionKey, index) => questionKey === normalizedAnswerKeys[index]
    );
  });

  return matchingBatch ?? openQuestionBatches[0] ?? [];
}

function normalizePrompt(content: string) {
  return content.trim().replace(/\s+/g, ' ');
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeBoundedText(value: string | null | undefined, maxLength: number) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return normalizedValue.slice(0, maxLength).trim();
}

function toSentenceCase(value: string) {
  if (!value) {
    return value;
  }

  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function derivePlanningSessionTitle(content: string) {
  const normalizedPrompt = normalizePrompt(content)
    .replace(/^(i want to|we want to|please|help me|can you)\s+/i, '')
    .replace(/[.!?].*$/, '');
  const titleWords = normalizedPrompt.split(' ').filter(Boolean).slice(0, 6);
  const derivedTitle = titleWords.join(' ').trim();

  if (!derivedTitle) {
    return 'Planning session';
  }

  return truncateText(toSentenceCase(derivedTitle), 72);
}

function derivePlanningSessionSummary(content: string) {
  return truncateText(normalizePrompt(content), 180);
}

function buildPlanningStatusMessage(stage: PlanningRunStage) {
  if (stage === 'queued') {
    return 'Queued the planning run and waiting for the executor to start...';
  }

  if (stage === 'planning') {
    return 'Turning the clarified requirements into a structured implementation plan...';
  }

  if (stage === 'clarifying') {
    return 'The planner needs clarification before it can continue.';
  }

  if (stage === 'completed') {
    return 'Planning completed successfully.';
  }

  if (stage === 'failed') {
    return 'The planning run failed and can be retried if the cause is recoverable.';
  }

  return 'Extracting requirements, checking readiness, and deciding whether clarification is still needed...';
}

function buildPlannerStatusMetadata({
  analysisDurationMs,
  stage,
  userMessageId,
  retryable = true,
  error,
  failureCode,
  phaseCount,
  planDurationMs,
  questionKeys,
  responseExcerpt,
  startedAt,
  totalDurationMs,
  validationIssues,
  discardedCandidateQuestions,
}: {
  analysisDurationMs?: number;
  stage: PlanningRunStage;
  userMessageId: number;
  retryable?: boolean;
  error?: string;
  failureCode?: StructuredAiFailureCode;
  phaseCount?: number;
  planDurationMs?: number;
  questionKeys?: string[];
  responseExcerpt?: string;
  startedAt?: string;
  totalDurationMs?: number;
  validationIssues?: string[];
  discardedCandidateQuestions?: DiscardedClarificationCandidate[];
}): PlannerStatusMetadata {
  const metadata: PlannerStatusMetadata = {
    retryable,
    stage,
    userMessageId,
  };

  if (error) {
    metadata.error = error;
  }

  if (failureCode) {
    metadata.failureCode = failureCode;
  }

  if (typeof phaseCount === 'number') {
    metadata.phaseCount = phaseCount;
  }

  if (typeof analysisDurationMs === 'number') {
    metadata.analysisDurationMs = analysisDurationMs;
  }

  if (typeof planDurationMs === 'number') {
    metadata.planDurationMs = planDurationMs;
  }

  if (questionKeys) {
    metadata.questionKeys = questionKeys;
  }

  if (responseExcerpt) {
    metadata.responseExcerpt = responseExcerpt;
  }

  if (startedAt) {
    metadata.startedAt = startedAt;
  }

  if (typeof totalDurationMs === 'number') {
    metadata.totalDurationMs = totalDurationMs;
  }

  if (validationIssues) {
    metadata.validationIssues = validationIssues;
  }

  if ((discardedCandidateQuestions?.length ?? 0) > 0) {
    metadata.discardedCandidateQuestions = discardedCandidateQuestions;
  }

  return metadata;
}

function parsePlannerStatusMetadata(
  metadata: PlanningSessionMessage['metadata_json']
): PlannerStatusMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const parsedMetadata = metadata as Record<string, unknown>;
  const stage =
    parsedMetadata.stage === 'queued' ||
    parsedMetadata.stage === 'analyzing' ||
    parsedMetadata.stage === 'clarifying' ||
    parsedMetadata.stage === 'planning' ||
    parsedMetadata.stage === 'completed' ||
    parsedMetadata.stage === 'failed'
      ? parsedMetadata.stage
      : undefined;
  const userMessageId =
    typeof parsedMetadata.userMessageId === 'number' &&
    Number.isFinite(parsedMetadata.userMessageId)
      ? parsedMetadata.userMessageId
      : undefined;
  const retryable =
    typeof parsedMetadata.retryable === 'boolean'
      ? parsedMetadata.retryable
      : undefined;
  const error =
    typeof parsedMetadata.error === 'string' ? parsedMetadata.error : undefined;
  const failureCode =
    parsedMetadata.failureCode === 'json_parse_failed' ||
    parsedMetadata.failureCode === 'schema_validation_failed'
      ? parsedMetadata.failureCode
      : undefined;
  const phaseCount =
    typeof parsedMetadata.phaseCount === 'number' &&
    Number.isFinite(parsedMetadata.phaseCount)
      ? parsedMetadata.phaseCount
      : undefined;
  const analysisDurationMs =
    typeof parsedMetadata.analysisDurationMs === 'number' &&
    Number.isFinite(parsedMetadata.analysisDurationMs)
      ? parsedMetadata.analysisDurationMs
      : undefined;
  const planDurationMs =
    typeof parsedMetadata.planDurationMs === 'number' &&
    Number.isFinite(parsedMetadata.planDurationMs)
      ? parsedMetadata.planDurationMs
      : undefined;
  const questionKeys = Array.isArray(parsedMetadata.questionKeys)
    ? parsedMetadata.questionKeys.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0
      )
    : undefined;
  const responseExcerpt =
    typeof parsedMetadata.responseExcerpt === 'string' &&
    parsedMetadata.responseExcerpt.trim().length > 0
      ? parsedMetadata.responseExcerpt
      : undefined;
  const startedAt =
    typeof parsedMetadata.startedAt === 'string' &&
    parsedMetadata.startedAt.trim().length > 0
      ? parsedMetadata.startedAt
      : undefined;
  const totalDurationMs =
    typeof parsedMetadata.totalDurationMs === 'number' &&
    Number.isFinite(parsedMetadata.totalDurationMs)
      ? parsedMetadata.totalDurationMs
      : undefined;
  const validationIssues = Array.isArray(parsedMetadata.validationIssues)
    ? parsedMetadata.validationIssues.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0
      )
    : undefined;
  const discardedCandidateQuestions = Array.isArray(
    parsedMetadata.discardedCandidateQuestions
  )
    ? parsedMetadata.discardedCandidateQuestions.reduce<DiscardedClarificationCandidate[]>(
        (result, value) => {
          if (
            value &&
            typeof value === 'object' &&
            typeof (value as Record<string, unknown>).question === 'string' &&
            typeof (value as Record<string, unknown>).questionKey === 'string' &&
            typeof (value as Record<string, unknown>).reason === 'string' &&
            (((value as Record<string, unknown>).source === 'analysis') ||
              (value as Record<string, unknown>).source === 'fallback')
          ) {
            result.push(value as DiscardedClarificationCandidate);
          }

          return result;
        },
        []
      )
    : undefined;

  return {
    analysisDurationMs,
    discardedCandidateQuestions,
    error,
    failureCode,
    phaseCount,
    planDurationMs,
    questionKeys,
    responseExcerpt,
    retryable,
    startedAt,
    stage,
    totalDurationMs,
    userMessageId,
    validationIssues,
  };
}

function resolvePlannerStage(
  message: PlanningSessionMessage | null
): PlanningRunStage {
  const metadata = parsePlannerStatusMetadata(message?.metadata_json ?? null);

  if (metadata.stage) {
    return metadata.stage;
  }

  return 'analyzing';
}

function resolvePlannerUserMessageId(
  message: PlanningSessionMessage,
  messages: PlanningSessionMessage[]
) {
  const metadata = parsePlannerStatusMetadata(message.metadata_json);

  if (typeof metadata.userMessageId === 'number') {
    return metadata.userMessageId;
  }

  return (
    [...messages]
      .reverse()
      .find((candidateMessage) => candidateMessage.role === 'user')?.id ?? null
  );
}

function doesUnknownMatchQuestion(unknown: string, question: PlanningQuestion) {
  const normalizedUnknownKey = normalizeQuestionKey(unknown);
  const normalizedUnknownText = normalizeQuestionText(unknown);

  return (
    question.question_key === normalizedUnknownKey ||
    normalizeQuestionKey(question.question_text) === normalizedUnknownKey ||
    normalizeQuestionText(question.question_text) === normalizedUnknownText
  );
}

function reconcilePlanningAnalysis({
  analysis,
  existingQuestions,
}: {
  analysis: PlanningTurnAnalysis;
  existingQuestions: PlanningQuestion[];
}): PlanningTurnAnalysis {
  const activeQuestions = existingQuestions.filter(
    (question) => question.status !== 'superseded'
  );
  const answeredQuestions = activeQuestions.filter(
    (question) => question.status === 'answered'
  );
  const seenQuestionKeys = new Set(activeQuestions.map((question) => question.question_key));
  const seenQuestionTexts = new Set(
    activeQuestions.map((question) => normalizeQuestionText(question.question_text))
  );
  const candidateQuestionKeys = new Set<string>();
  const candidateQuestionTexts = new Set<string>();

  return {
    ...analysis,
    unresolvedUnknowns: dedupeStrings(
      analysis.unresolvedUnknowns.filter(
        (unknown) =>
          !answeredQuestions.some((question) => doesUnknownMatchQuestion(unknown, question))
      )
    ),
    blockingUnknowns: dedupeStrings(
      analysis.blockingUnknowns.filter(
        (unknown) =>
          !answeredQuestions.some((question) => doesUnknownMatchQuestion(unknown, question))
      )
    ),
    resolvedQuestionKeys: dedupeStrings(
      analysis.resolvedQuestionKeys.map(normalizeQuestionKey)
    ),
    candidateQuestions: analysis.candidateQuestions.filter((question) => {
      const normalizedQuestionKey = normalizeQuestionKey(
        question.questionKey || question.question
      );
      const normalizedQuestionText = normalizeQuestionText(question.question);

      if (
        seenQuestionKeys.has(normalizedQuestionKey) ||
        seenQuestionTexts.has(normalizedQuestionText) ||
        candidateQuestionKeys.has(normalizedQuestionKey) ||
        candidateQuestionTexts.has(normalizedQuestionText)
      ) {
        return false;
      }

      candidateQuestionKeys.add(normalizedQuestionKey);
      candidateQuestionTexts.add(normalizedQuestionText);
      return true;
    }),
  };
}

function deriveFallbackObjective({
  analysis,
  objective,
  summary,
  targetOutcome,
}: {
  analysis: PlanningTurnAnalysis;
  objective: string | null;
  summary: string | null;
  targetOutcome: string | null;
}) {
  if (objective?.trim()) {
    return objective;
  }

  return (
    normalizeBoundedText(targetOutcome, MAX_CONTEXT_OBJECTIVE_LENGTH) ??
    normalizeBoundedText(summary, MAX_CONTEXT_OBJECTIVE_LENGTH) ??
    normalizeBoundedText(analysis.summary, MAX_CONTEXT_OBJECTIVE_LENGTH) ??
    normalizeBoundedText(analysis.title, MAX_CONTEXT_OBJECTIVE_LENGTH)
  );
}

function mergeContextStringArrayPatch(
  currentValues: string[],
  patchValues: string[] | undefined
) {
  if (patchValues === undefined) {
    return currentValues;
  }

  const normalizedPatchValues = dedupeStrings(patchValues);

  if (normalizedPatchValues.length === 0) {
    return currentValues;
  }

  return dedupeStrings([...currentValues, ...normalizedPatchValues]);
}

function mergeKnownRequirements(
  currentValues: string[],
  nextValues: string[]
) {
  const normalizedNextValues = dedupeStrings(nextValues);

  if (normalizedNextValues.length === 0) {
    return currentValues;
  }

  return dedupeStrings([...currentValues, ...normalizedNextValues]);
}

function mergeTechnicalDecisionPatch(
  currentValues: PlanningContext['technicalDecisions'],
  patchValues:
    | NonNullable<PlanningContext['technicalDecisions']>
    | undefined
) {
  if (patchValues === undefined) {
    return currentValues ?? [];
  }

  const normalizedPatchValues = dedupeTechnicalDecisions(patchValues);

  if (normalizedPatchValues.length === 0) {
    return currentValues ?? [];
  }

  return dedupeTechnicalDecisions([...(currentValues ?? []), ...normalizedPatchValues]);
}

function mergePlanningContext(
  currentContext: PlanningContext,
  analysis: PlanningTurnAnalysis
): PlanningContext {
  const patch = analysis.contextPatch;
  const summary =
    patch.summary !== undefined ? patch.summary : currentContext.summary;
  const targetOutcome =
    patch.targetOutcome !== undefined
      ? patch.targetOutcome
      : currentContext.targetOutcome;
  const objective =
    patch.objective !== undefined ? patch.objective : currentContext.objective;

  return {
    objective: deriveFallbackObjective({
      analysis,
      objective,
      summary,
      targetOutcome,
    }),
    summary,
    targetOutcome,
    inScope: mergeContextStringArrayPatch(currentContext.inScope, patch.inScope),
    outOfScope: mergeContextStringArrayPatch(currentContext.outOfScope, patch.outOfScope),
    assumptions: mergeContextStringArrayPatch(currentContext.assumptions, patch.assumptions),
    constraints: mergeContextStringArrayPatch(currentContext.constraints, patch.constraints),
    acceptanceCriteria: mergeContextStringArrayPatch(
      currentContext.acceptanceCriteria,
      patch.acceptanceCriteria
    ),
    knownRequirements: mergeKnownRequirements(
      currentContext.knownRequirements,
      analysis.knownRequirements
    ),
    unresolvedUnknowns: dedupeStrings(analysis.unresolvedUnknowns),
    blockingUnknowns: dedupeStrings(analysis.blockingUnknowns),
    affectedAreas: mergeContextStringArrayPatch(
      currentContext.affectedAreas,
      patch.affectedAreas
    ),
    risks: mergeContextStringArrayPatch(currentContext.risks, patch.risks),
    dependencies: mergeContextStringArrayPatch(
      currentContext.dependencies,
      patch.dependencies
    ),
    technicalDecisions: mergeTechnicalDecisionPatch(
      currentContext.technicalDecisions,
      patch.technicalDecisions
    ),
    estimatedComplexity:
      patch.estimatedComplexity !== undefined
        ? patch.estimatedComplexity
        : currentContext.estimatedComplexity,
    planningConfidence: clampConfidence(
      analysis.confidence ?? patch.planningConfidence ?? currentContext.planningConfidence
    ),
  };
}

function hasConcretePlanningDetails(items: string[]) {
  return items.some((item) => {
    const normalizedItem = item.trim();
    if (normalizedItem.length >= 16) {
      return true;
    }

    return normalizedItem.split(/\s+/).filter(Boolean).length >= 3;
  });
}

function countAnsweredClarificationQuestions(questions: PlanningQuestion[]) {
  return questions.filter((question) => question.status === 'answered').length;
}

function evaluatePlanningReadiness({
  context,
  analysis,
  questions,
}: {
  context: PlanningContext;
  analysis: PlanningTurnAnalysis;
  questions: PlanningQuestion[];
}): PlanningReadiness {
  const objectiveClear = Boolean(context.objective?.trim());
  const answeredClarificationCount = countAnsweredClarificationQuestions(questions);
  const hasConcreteConstraints = hasConcretePlanningDetails(context.constraints);
  const hasConcreteDependencies = hasConcretePlanningDetails(context.dependencies);
  const hasConcreteKnownRequirements = hasConcretePlanningDetails(context.knownRequirements);
  const hasExplicitTechnicalDecision =
    (context.technicalDecisions ?? []).some(
      (decision) => decision.source === 'explicit' || decision.source === 'clarified'
    );
  const hasBoundaryEvidence =
    answeredClarificationCount > 0 ||
    context.outOfScope.length > 0 ||
    hasConcreteConstraints ||
    hasConcreteDependencies ||
    hasExplicitTechnicalDecision;
  const hasScopeSignals =
    context.inScope.length > 0 ||
    context.outOfScope.length > 0 ||
    hasConcreteKnownRequirements;
  const scopeBounded = hasScopeSignals && hasBoundaryEvidence;
  const hasAcceptanceCriteria = context.acceptanceCriteria.length > 0;
  const blockingUnknowns = dedupeStrings(context.blockingUnknowns);
  const unresolvedUnknowns = dedupeStrings(context.unresolvedUnknowns);
  const confidence = clampConfidence(context.planningConfidence);
  const readinessChecksPass =
    objectiveClear &&
    scopeBounded &&
    hasAcceptanceCriteria &&
    blockingUnknowns.length === 0 &&
    unresolvedUnknowns.length === 0;
  const confidenceSupportsPlanning =
    confidence >= READINESS_CONFIDENCE_THRESHOLD || answeredClarificationCount > 0;
  const clarifiedHighConfidenceOverride =
    answeredClarificationCount > 0 &&
    readinessChecksPass &&
    confidence >= READINESS_CONFIDENCE_THRESHOLD;
  const canGeneratePlan =
    readinessChecksPass &&
    ((analysis.recommendedNextAction === 'generate_plan' &&
      confidenceSupportsPlanning) ||
      clarifiedHighConfidenceOverride);
  const reasonSummary = [
    objectiveClear ? 'Objective is clear.' : 'Objective is still ambiguous.',
    scopeBounded ? 'Scope is reasonably bounded.' : 'Scope is still materially unbounded.',
    hasAcceptanceCriteria
      ? 'Acceptance criteria are present.'
      : 'Acceptance criteria are still missing.',
    hasBoundaryEvidence
      ? 'There is enough boundary evidence to trust the scope.'
      : 'The scope still lacks clear boundaries or clarified decisions.',
    blockingUnknowns.length === 0
      ? 'No blocking unknowns remain.'
      : 'Blocking unknowns still need clarification.',
    unresolvedUnknowns.length === 0
      ? 'No unresolved unknowns remain.'
      : 'Unresolved unknowns still need clarification.',
    analysis.recommendedNextAction === 'generate_plan'
      ? 'Model signaled readiness to generate the plan.'
      : clarifiedHighConfidenceOverride
        ? 'Model still preferred clarification, but the clarified inputs now meet the planning threshold.'
        : 'Model still prefers clarification before planning.',
    confidenceSupportsPlanning
      ? 'Confidence is high enough to plan.'
      : 'Confidence is still below the planning threshold.',
  ];

  return {
    objectiveClear,
    scopeBounded,
    hasAcceptanceCriteria,
    knownRequirements: dedupeStrings(analysis.knownRequirements),
    unresolvedUnknowns,
    blockingUnknowns,
    confidence,
    recommendedNextAction: canGeneratePlan ? 'generate_plan' : 'ask_clarification',
    reasonSummary,
  };
}

function listReadinessBlockers(readiness: PlanningReadiness) {
  const blockers: string[] = [];

  if (!readiness.objectiveClear) {
    blockers.push('the core objective is still ambiguous');
  }

  if (!readiness.scopeBounded) {
    blockers.push('the first-release scope is still too loose');
  }

  if (!readiness.hasAcceptanceCriteria) {
    blockers.push('success criteria for the first release are still missing');
  }

  if (readiness.blockingUnknowns.length > 0) {
    blockers.push(`blocking unknowns remain: ${readiness.blockingUnknowns.join('; ')}`);
  }

  if (readiness.unresolvedUnknowns.length > 0) {
    blockers.push(
      `some implementation details are still unresolved: ${readiness.unresolvedUnknowns.join('; ')}`
    );
  }

  return blockers;
}

function selectClarificationQuestions({
  candidateQuestions,
  existingQuestions,
  source,
}: {
  candidateQuestions: PlanningQuestionCandidate[];
  existingQuestions: PlanningQuestion[];
  source: ClarificationQuestionSelectionSource;
}) {
  const seenExistingKeys = new Set(
    existingQuestions.map((question) => question.question_key)
  );
  const seenExistingTexts = new Set(
    existingQuestions.map((question) => normalizeQuestionText(question.question_text))
  );
  const seenCandidateKeys = new Set<string>();
  const seenCandidateTexts = new Set<string>();
  const acceptedCandidateQuestions: PlanningQuestionCandidate[] = [];
  const discardedCandidateQuestions: DiscardedClarificationCandidate[] = [];

  for (const question of candidateQuestions.map((candidateQuestion) => ({
    ...candidateQuestion,
    options: normalizeQuestionOptions(candidateQuestion.options),
    questionKey: normalizeQuestionKey(
      candidateQuestion.questionKey || candidateQuestion.question
    ),
    question: candidateQuestion.question.trim(),
    whyThisMatters: candidateQuestion.whyThisMatters.trim(),
  }))) {
    const normalizedQuestionText = normalizeQuestionText(question.question);
    const candidateIdentity = {
      question: question.question,
      questionKey: question.questionKey,
      source,
    };

    if (question.options.length !== 4) {
      discardedCandidateQuestions.push({
        ...candidateIdentity,
        reason: 'Options did not normalize into 3 unique guided choices.',
      });
      continue;
    }

    if (
      seenExistingKeys.has(question.questionKey) ||
      seenCandidateKeys.has(question.questionKey)
    ) {
      discardedCandidateQuestions.push({
        ...candidateIdentity,
        reason: 'Question key already exists in the current planning session.',
      });
      continue;
    }

    if (
      seenExistingTexts.has(normalizedQuestionText) ||
      seenCandidateTexts.has(normalizedQuestionText)
    ) {
      discardedCandidateQuestions.push({
        ...candidateIdentity,
        reason: 'Question text duplicates an existing or already-selected card.',
      });
      continue;
    }

    seenCandidateKeys.add(question.questionKey);
    seenCandidateTexts.add(normalizedQuestionText);
    acceptedCandidateQuestions.push(question);
  }

  const prioritizedQuestions = acceptedCandidateQuestions.sort((left, right) => {
      if (left.blocking !== right.blocking) {
        return left.blocking ? -1 : 1;
      }

      if (left.required !== right.required) {
        return left.required ? -1 : 1;
      }

      return left.question.localeCompare(right.question);
    });
  const selectedQuestions = prioritizedQuestions.slice(0, MAX_QUESTIONS_PER_TURN);

  for (const question of prioritizedQuestions.slice(MAX_QUESTIONS_PER_TURN)) {
    discardedCandidateQuestions.push({
      question: question.question,
      questionKey: question.questionKey,
      reason: 'Lower priority than other clarification cards in this batch.',
      source,
    });
  }

  return {
    discardedCandidateQuestions,
    selectedQuestions,
  };
}

function buildClarificationIntro(questions: PlanningQuestionCandidate[]) {
  if (questions.length === 1) {
    return 'I need one quick decision before I can build a reliable implementation plan.';
  }

  return `I need ${questions.length} quick decisions before I can build a reliable implementation plan.`;
}

function buildClarificationAnswerSummary({
  questions,
  answers,
}: {
  questions: PlanningQuestion[];
  answers: PlanningQuestionAnswerInput[];
}) {
  const answersByQuestionKey = new Map(
    answers.map((answer) => [answer.questionKey, answer])
  );

  return [
    'Clarification answers submitted:',
    ...questions.map((question, index) => {
      const answer = answersByQuestionKey.get(question.question_key);
      const selectedOption = question.options_json.find(
        (option) => option.optionKey === answer?.selectedOptionKey
      );
      const note =
        selectedOption?.optionKey === NONE_OF_THE_ABOVE_OPTION.optionKey
          ? normalizeBoundedText(answer?.note ?? null, MAX_PLANNER_ANSWER_NOTE_LENGTH)
          : null;

      return [
        `${index + 1}. ${question.question_text}`,
        `Answer: ${selectedOption?.label ?? 'Unknown option'}`,
        note ? `Note: ${note}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    }),
  ].join('\n\n');
}

function buildClarificationAnswerMetadata({
  questions,
  answers,
}: {
  questions: PlanningQuestion[];
  answers: PlanningQuestionAnswerInput[];
}) {
  const questionsByKey = new Map(
    questions.map((question) => [question.question_key, question])
  );

  return {
    answers: answers.map((answer) => {
      const question = questionsByKey.get(answer.questionKey);
      const selectedOption = question?.options_json.find(
        (option) => option.optionKey === answer.selectedOptionKey
      );

      return {
        note: answer.note?.trim() || null,
        questionKey: answer.questionKey,
        questionText: question?.question_text ?? '',
        selectedOptionKey: answer.selectedOptionKey,
        selectedOptionLabel: selectedOption?.label ?? '',
      };
    }),
    submissionMode: 'clarification_batch',
  };
}

function buildClarificationLimitMessage(readiness: PlanningReadiness) {
  const blockers = listReadinessBlockers(readiness);
  const blockerSummary =
    blockers.length > 0
      ? `I am still missing: ${blockers.join('; ')}.`
      : 'The request still needs one more concrete implementation decision before planning.';

  return `I am not ready to generate a trustworthy plan yet. ${blockerSummary} Please narrow the request or answer the missing implementation details in one message.`;
}

function buildClarificationRecoveryMessage(readiness: PlanningReadiness) {
  const blockers = listReadinessBlockers(readiness);
  const blockerSummary =
    blockers.length > 0
      ? `I am still missing: ${blockers.join('; ')}.`
      : 'The planner still needs a tighter clarification step.';

  return `I still need clarification before planning, but I could not generate actionable clarification cards from the current session state. ${blockerSummary} Retry this turn or restate the remaining decisions in one message.`;
}

function buildPlanSummaryMessage(planArtifact: PlanningPlanArtifact) {
  return `Plan generated.\n\n${planArtifact.summary}`;
}

function mapTranscriptForModel(messages: PlanningSessionMessage[]) {
  return messages
    .filter((message) => message.message_kind !== 'planner_status')
    .map((message) => ({
      role: message.role,
      messageKind: message.message_kind,
      content: message.content,
    }));
}

function validateClarificationBatchAnswers({
  answers,
  openQuestions,
}: {
  answers: PlanningSessionClarificationBatchRequest['answers'];
  openQuestions: PlanningQuestion[];
}): PlanningQuestionAnswerInput[] {
  if (openQuestions.length === 0) {
    throw new BadRequestError('There are no open clarification cards to answer');
  }

  if (answers.length !== openQuestions.length) {
    throw new BadRequestError('Answer every clarification card before submitting');
  }

  const openQuestionsByKey = new Map(
    openQuestions.map((question) => [question.question_key, question])
  );
  const seenQuestionKeys = new Set<string>();
  const normalizedAnswers = answers.map((answer) => {
    const questionKey = normalizeQuestionKey(answer.questionKey);
    const selectedOptionKey = normalizeQuestionOptionKey(answer.selectedOptionKey);
    const note = answer.note?.trim() || null;

    if (seenQuestionKeys.has(questionKey)) {
      throw new BadRequestError('Each clarification card can only be answered once');
    }

    seenQuestionKeys.add(questionKey);

    const question = openQuestionsByKey.get(questionKey);

    if (!question) {
      throw new BadRequestError('Clarification answers do not match the current card set');
    }

    const selectedOption = question.options_json.find(
      (option) => option.optionKey === selectedOptionKey
    );

    if (!selectedOption) {
      throw new BadRequestError('Selected clarification option is invalid');
    }

    return {
      note,
      questionKey,
      selectedOptionKey,
    };
  });

  for (const question of openQuestions) {
    if (!seenQuestionKeys.has(question.question_key)) {
      throw new BadRequestError('Answer every clarification card before submitting');
    }
  }

  return normalizedAnswers;
}

async function buildPlanningSessionDetail(
  sessionRecord: PlanningSessionRecord
): Promise<PlanningSessionDetail> {
  const [messages, questions, activeRun] = await Promise.all([
    PlanningSessionMessages.listMessagesForSession(sessionRecord.id),
    PlanningSessionQuestions.listQuestionsForSession(sessionRecord.id),
    PlanningRuns.getLatestRunForSession(sessionRecord.id),
  ]);

  return {
    session: PlanningSessions.mapSession(sessionRecord),
    messages,
    questions,
    context: sessionRecord.context_json,
    readiness: sessionRecord.readiness_json,
    planArtifact: sessionRecord.plan_artifact_json,
    activeRun,
  };
}

async function publishPlanningSessionUpdate(detail: PlanningSessionDetail) {
  try {
    await publishUserUpdate(detail.session.created_by, {
      payload: detail,
      type: 'planning:session:updated',
    });
  } catch (error) {
    console.error('Failed to publish planning session update:', error);
  }
}

async function publishPlanningSessionUpdateById(sessionId: number) {
  const sessionRecord = await PlanningSessions.getSessionById(sessionId);

  if (!sessionRecord) {
    return null;
  }

  const detail = await buildPlanningSessionDetail(sessionRecord);
  await publishPlanningSessionUpdate(detail);
  return detail;
}

function isPlanningRunRetryable(run: PlanningRun) {
  return run.state === 'queued' || run.state === 'failed' || run.state === 'running';
}

async function requeuePlanningRun({
  run,
  resetAttemptCount = false,
}: {
  run: PlanningRun;
  resetAttemptCount?: boolean;
}) {
  const statusMessage = await PlanningSessionMessages.getMessageById(run.status_message_id);

  if (!statusMessage) {
    throw new BadRequestError('Planning run status message is missing');
  }

  const userMessageId =
    parsePlannerStatusMetadata(statusMessage.metadata_json).userMessageId ??
    run.trigger_message_id;

  await db.transaction(async (trx) => {
    await PlanningRuns.updateRun(
      run.id,
      {
        attemptCount: resetAttemptCount ? 0 : run.attempt_count,
        errorMessage: null,
        finishedAt: null,
        metadata: {
          ...(run.metadata_json ?? {}),
          retryRequestedAt: new Date().toISOString(),
        },
        stage: 'queued',
        startedAt: null,
        state: 'queued',
      },
      trx
    );
    await PlanningSessions.updateSession(
      run.session_id,
      {
        plannerState: 'queued',
      },
      trx
    );
    await PlanningSessionMessages.updateMessage(
      run.status_message_id,
      {
        content: buildPlanningStatusMessage('queued'),
        status: 'pending',
        metadata: buildPlannerStatusMetadata({
          retryable: true,
          stage: 'queued',
          startedAt: new Date().toISOString(),
          userMessageId,
        }),
      },
      trx
    );
  });

  await enqueuePlanningRun(run.id);
  return publishPlanningSessionUpdateById(run.session_id);
}

async function persistPlanningFailure({
  analysisDurationMs,
  sessionId,
  runId,
  processingMessageId,
  planDurationMs,
  title,
  summary,
  context,
  readiness,
  stage,
  startedAt,
  userMessageId,
  errorMessage,
  failureCode,
  responseExcerpt,
  retryable,
  validationIssues,
  discardedCandidateQuestions,
}: {
  analysisDurationMs?: number;
  sessionId: number;
  runId: number;
  processingMessageId: number;
  planDurationMs?: number;
  title: string;
  summary: string;
  context: PlanningContext;
  readiness: PlanningReadiness;
  stage: PlanningRunStage;
  startedAt?: string;
  userMessageId: number;
  errorMessage: string;
  failureCode?: StructuredAiFailureCode;
  responseExcerpt?: string;
  retryable?: boolean;
  validationIssues?: string[];
  discardedCandidateQuestions?: DiscardedClarificationCandidate[];
}) {
  await db.transaction(async (trx) => {
    await PlanningRuns.updateRun(
      runId,
      {
        errorMessage,
        finishedAt: new Date().toISOString(),
        metadata: {
          ...(await PlanningRuns.getRunById(runId, trx))?.metadata_json,
          analysisDurationMs,
          failureCode,
          planDurationMs,
          responseExcerpt,
          retryable,
          stage: 'failed',
          totalDurationMs:
            startedAt && Number.isFinite(new Date(startedAt).getTime())
              ? Math.max(0, Date.now() - new Date(startedAt).getTime())
              : undefined,
          validationIssues,
          discardedCandidateQuestions,
        },
        stage: 'failed',
        state: 'failed',
      },
      trx
    );
    await PlanningSessions.updateSession(
      sessionId,
      {
        title,
        summary,
        plannerState: 'failed',
        context,
        readiness,
      },
      trx
    );
    await PlanningSessionMessages.updateMessage(
      processingMessageId,
      {
        content: errorMessage,
        status: 'failed',
        metadata: buildPlannerStatusMetadata({
          analysisDurationMs,
          stage,
          userMessageId,
          error: errorMessage,
          failureCode,
          planDurationMs,
          responseExcerpt,
          retryable,
          startedAt,
          totalDurationMs:
            startedAt && Number.isFinite(new Date(startedAt).getTime())
              ? Math.max(0, Date.now() - new Date(startedAt).getTime())
              : undefined,
          validationIssues,
          discardedCandidateQuestions,
        }),
      },
      trx
    );
  });

  if (
    failureCode ||
    responseExcerpt ||
    (validationIssues?.length ?? 0) > 0 ||
    (discardedCandidateQuestions?.length ?? 0) > 0
  ) {
    console.error('[PLANNING_FAILURE]', {
      analysisDurationMs,
      discardedCandidateQuestions,
      errorMessage,
      failureCode,
      planDurationMs,
      responseExcerpt,
      retryable,
      runId,
      sessionId,
      stage,
      userMessageId,
      validationIssues,
    });
  }

  await publishPlanningSessionUpdateById(sessionId);
}

function extractStructuredFailureDetails(error: unknown) {
  if (!(error instanceof StructuredAiResponseError)) {
    return {};
  }

  return {
    failureCode: error.failureCode,
    responseExcerpt: error.responseExcerpt,
    validationIssues: error.validationIssues,
  };
}

function canRecoverAnalysisParseFailureWithClarification({
  error,
  readiness,
}: {
  error: unknown;
  readiness: PlanningReadiness;
}) {
  return (
    error instanceof StructuredAiResponseError &&
    error.failureCode === 'json_parse_failed' &&
    error.message === 'Failed to analyze the planning session' &&
    readiness.recommendedNextAction === 'ask_clarification'
  );
}

async function recoverAnalysisParseFailureWithClarification({
  sessionRecord,
  processingMessage,
  run,
  existingQuestions,
  currentReadiness,
  userMessageId,
  analysisDurationMs,
  startedAt,
  startedAtMs,
}: {
  sessionRecord: PlanningSessionRecord;
  processingMessage: PlanningSessionMessage;
  run: PlanningRun;
  existingQuestions: PlanningQuestion[];
  currentReadiness: PlanningReadiness;
  userMessageId: number;
  analysisDurationMs: number | undefined;
  startedAt: string;
  startedAtMs: number;
}) {
  const heuristicSelection = selectClarificationQuestions({
    candidateQuestions: buildHeuristicClarificationQuestions({
      readiness: currentReadiness,
    }),
    existingQuestions,
    source: 'fallback',
  });
  let selectedQuestions = heuristicSelection.selectedQuestions;

  if (selectedQuestions.length === 0) {
    selectedQuestions = [
      buildLastResortClarificationQuestion({
        existingQuestions,
        readiness: currentReadiness,
      }),
    ];
  }

  await db.transaction(async (trx) => {
    const existingOpenQuestionKeys = existingQuestions
      .filter((question) => question.status === 'open')
      .map((question) => question.question_key);

    await PlanningSessionQuestions.supersedeOpenQuestions(
      sessionRecord.id,
      existingOpenQuestionKeys,
      trx
    );
    await PlanningSessionMessages.updateMessage(
      processingMessage.id,
      {
        messageKind: 'clarification_questions',
        content: buildClarificationIntro(selectedQuestions),
        status: 'completed',
        metadata: buildPlannerStatusMetadata({
          analysisDurationMs,
          stage: 'clarifying',
          userMessageId,
          questionKeys: selectedQuestions.map((question) => question.questionKey),
          startedAt,
          totalDurationMs:
            Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : undefined,
        }),
      },
      trx
    );

    for (const question of selectedQuestions) {
      await PlanningSessionQuestions.createQuestion(
        {
          sessionId: sessionRecord.id,
          questionKey: question.questionKey,
          category: question.category,
          questionText: question.question,
          whyThisMatters: question.whyThisMatters,
          options: question.options,
          isRequired: question.required,
          isBlocking: question.blocking,
          askedInMessageId: processingMessage.id,
          askedAt: new Date(),
        },
        trx
      );
    }

    await PlanningRuns.updateRun(
      run.id,
      {
        finishedAt: new Date().toISOString(),
        metadata: {
          ...(run.metadata_json ?? {}),
          analysisDurationMs,
          analysisRecovery: 'json_parse_failed',
          questionKeys: selectedQuestions.map((question) => question.questionKey),
          retryable: false,
          totalDurationMs:
            Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : undefined,
        },
        stage: 'clarifying',
        state: 'waiting_for_clarification',
      },
      trx
    );
    await PlanningSessions.updateSession(
      sessionRecord.id,
      {
        plannerState: 'clarifying',
        readiness: currentReadiness,
        clarificationTurnCount: sessionRecord.clarification_turn_count + 1,
      },
      trx
    );
  });

  console.error('[PLANNING_ANALYSIS_PARSE_RECOVERY]', {
    analysisDurationMs,
    runId: run.id,
    sessionId: sessionRecord.id,
    userMessageId,
  });

  const latestSession = await PlanningSessions.getSessionById(sessionRecord.id);

  if (!latestSession) {
    throw new BadRequestError('Planning session not found');
  }

  const detail = await buildPlanningSessionDetail(latestSession);
  await publishPlanningSessionUpdate(detail);
  return detail;
}

async function continuePlanningRun({
  sessionRecord,
  processingMessage,
  run,
}: {
  sessionRecord: PlanningSessionRecord;
  processingMessage: PlanningSessionMessage;
  run: PlanningRun;
}): Promise<PlanningSessionDetail> {
  const existingMessages = await PlanningSessionMessages.listMessagesForSession(sessionRecord.id);
  const existingQuestions = await PlanningSessionQuestions.listQuestionsForSession(
    sessionRecord.id
  );
  const userMessageId = resolvePlannerUserMessageId(processingMessage, existingMessages);

  if (!userMessageId) {
    throw new BadRequestError('Planning session message context is missing');
  }

  let latestTitle = sessionRecord.title;
  let latestSummary = sessionRecord.summary;
  let latestContext = sessionRecord.context_json;
  let latestReadiness = sessionRecord.readiness_json;
  let latestStage = resolvePlannerStage(processingMessage);
  const executor = resolvePlanningExecutor(run.executor_kind);
  const existingPlannerMetadata = parsePlannerStatusMetadata(
    processingMessage.metadata_json
  );
  const startedAt = existingPlannerMetadata.startedAt ?? processingMessage.updated_at;
  const startedAtMs = new Date(startedAt).getTime();
  const transcript = mapTranscriptForModel(existingMessages);
  let analysisDurationMs: number | undefined;
  let discardedCandidateQuestions: DiscardedClarificationCandidate[] = [];
  let planDurationMs: number | undefined;

  try {
    await executor.assertReady();

    const analysisStartedAt = Date.now();
    let rawAnalysis: PlanningTurnAnalysis;

    try {
      rawAnalysis = await executor.analyzeTurn({
        sessionTitle: sessionRecord.title,
        originalPrompt: sessionRecord.original_prompt,
        context: sessionRecord.context_json,
        readiness: sessionRecord.readiness_json,
        questions: existingQuestions,
        messages: transcript,
      });
      analysisDurationMs = Date.now() - analysisStartedAt;
    } catch (error) {
      analysisDurationMs = Date.now() - analysisStartedAt;

      if (
        canRecoverAnalysisParseFailureWithClarification({
          error,
          readiness: sessionRecord.readiness_json,
        })
      ) {
        return recoverAnalysisParseFailureWithClarification({
          sessionRecord,
          processingMessage,
          run,
          existingQuestions,
          currentReadiness: sessionRecord.readiness_json,
          userMessageId,
          analysisDurationMs,
          startedAt,
          startedAtMs,
        });
      }

      throw error;
    }

    const analysis = reconcilePlanningAnalysis({
      analysis: rawAnalysis,
      existingQuestions,
    });
    const nextContext = mergePlanningContext(sessionRecord.context_json, analysis);
    const nextReadiness = evaluatePlanningReadiness({
      context: nextContext,
      analysis,
      questions: existingQuestions,
    });
    const nextTitle = analysis.title?.trim() || sessionRecord.title;
    const nextSummary =
      analysis.summary?.trim() ||
      nextContext.summary ||
      sessionRecord.summary;

    latestTitle = nextTitle;
    latestSummary = nextSummary;
    latestContext = nextContext;
    latestReadiness = nextReadiness;

    if (nextReadiness.recommendedNextAction === 'generate_plan') {
      latestStage = 'planning';

      await db.transaction(async (trx) => {
        await PlanningRuns.updateRun(
          run.id,
          {
            metadata: {
              ...(run.metadata_json ?? {}),
              analysisDurationMs,
              retryable: true,
              totalDurationMs:
                Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : undefined,
            },
            stage: 'planning',
            state: 'running',
          },
          trx
        );
        await PlanningSessions.updateSession(
          sessionRecord.id,
          {
            title: nextTitle,
            summary: nextSummary,
            plannerState: 'planning',
            context: nextContext,
            readiness: nextReadiness,
          },
          trx
        );
        await PlanningSessionMessages.updateMessage(
          processingMessage.id,
          {
            content: buildPlanningStatusMessage('planning'),
            status: 'processing',
            metadata: buildPlannerStatusMetadata({
              analysisDurationMs,
              stage: 'planning',
              userMessageId,
              startedAt,
              totalDurationMs:
                Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : undefined,
            }),
          },
          trx
        );
      });

      await publishPlanningSessionUpdateById(sessionRecord.id);

      const planStartedAt = Date.now();
      const planArtifact = await executor.generatePlan({
        sessionTitle: nextTitle,
        originalPrompt: sessionRecord.original_prompt,
        context: nextContext,
        readiness: nextReadiness,
        questions: existingQuestions,
        messages: transcript,
      });
      planDurationMs = Date.now() - planStartedAt;

      await db.transaction(async (trx) => {
        await PlanningSessionQuestions.markQuestionsAnswered(
          sessionRecord.id,
          analysis.resolvedQuestionKeys.map(normalizeQuestionKey),
          userMessageId,
          trx
        );
        await PlanningRuns.updateRun(
          run.id,
          {
            finishedAt: new Date().toISOString(),
            metadata: {
              ...(run.metadata_json ?? {}),
              analysisDurationMs,
              phaseCount: planArtifact.implementationPhases.length,
              planDurationMs,
              retryable: false,
              totalDurationMs:
                Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : undefined,
            },
            stage: 'completed',
            state: 'completed',
          },
          trx
        );
        await PlanningSessions.updateSession(
          sessionRecord.id,
          {
            title: nextTitle,
            summary: nextSummary,
            plannerState: 'plan_generated',
            context: nextContext,
            readiness: nextReadiness,
            planArtifact,
          },
          trx
        );
        await PlanningSessionMessages.updateMessage(
          processingMessage.id,
          {
            messageKind: 'plan_summary',
            content: buildPlanSummaryMessage(planArtifact),
            status: 'completed',
            metadata: buildPlannerStatusMetadata({
              analysisDurationMs,
              stage: 'completed',
              userMessageId,
              phaseCount: planArtifact.implementationPhases.length,
              planDurationMs,
              startedAt,
              totalDurationMs:
                Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : undefined,
            }),
          },
          trx
        );
      });
    } else {
      const clarificationTurnLimitReached =
        sessionRecord.clarification_turn_count >= CLARIFICATION_TURN_LIMIT;
      const analysisSelection = selectClarificationQuestions({
        candidateQuestions: analysis.candidateQuestions,
        existingQuestions,
        source: 'analysis',
      });
      let selectedQuestions = analysisSelection.selectedQuestions;
      discardedCandidateQuestions = analysisSelection.discardedCandidateQuestions;

      if (selectedQuestions.length === 0) {
        if (
          nextReadiness.blockingUnknowns.length > 0 ||
          nextReadiness.unresolvedUnknowns.length > 0
        ) {
          try {
            const fallbackQuestions = await executor.generateClarificationQuestions({
              sessionTitle: nextTitle,
              originalPrompt: sessionRecord.original_prompt,
              context: nextContext,
              readiness: nextReadiness,
              questions: existingQuestions,
              messages: transcript,
            });

            const fallbackSelection = selectClarificationQuestions({
              candidateQuestions: fallbackQuestions,
              existingQuestions,
              source: 'fallback',
            });

            selectedQuestions = fallbackSelection.selectedQuestions;
            discardedCandidateQuestions = [
              ...discardedCandidateQuestions,
              ...fallbackSelection.discardedCandidateQuestions,
            ];
          } catch (error) {
            if (error instanceof StructuredAiResponseError) {
              console.error('[PLANNING_FALLBACK_QUESTION_GENERATION]', {
                failureCode: error.failureCode,
                responseExcerpt: error.responseExcerpt,
                runId: run.id,
                sessionId: sessionRecord.id,
                userMessageId,
                validationIssues: error.validationIssues,
              });
            } else {
              throw error;
            }
          }
        }
      }

      if (selectedQuestions.length === 0) {
        const heuristicSelection = selectClarificationQuestions({
          candidateQuestions: buildHeuristicClarificationQuestions({
            readiness: nextReadiness,
          }),
          existingQuestions,
          source: 'fallback',
        });

        selectedQuestions = heuristicSelection.selectedQuestions;
        discardedCandidateQuestions = [
          ...discardedCandidateQuestions,
          ...heuristicSelection.discardedCandidateQuestions,
        ];
      }

      if (selectedQuestions.length === 0) {
        selectedQuestions = [
          buildLastResortClarificationQuestion({
            existingQuestions,
            readiness: nextReadiness,
          }),
        ];
      }

      await db.transaction(async (trx) => {
        await PlanningSessionQuestions.markQuestionsAnswered(
          sessionRecord.id,
          analysis.resolvedQuestionKeys.map(normalizeQuestionKey),
          userMessageId,
          trx
        );

        if (selectedQuestions.length > 0) {
          const existingOpenQuestionKeys = existingQuestions
            .filter((question) => question.status === 'open')
            .map((question) => question.question_key);

          await PlanningSessionQuestions.supersedeOpenQuestions(
            sessionRecord.id,
            existingOpenQuestionKeys,
            trx
          );
          await PlanningSessionMessages.updateMessage(
            processingMessage.id,
            {
              messageKind: 'clarification_questions',
              content: buildClarificationIntro(selectedQuestions),
              status: 'completed',
              metadata: buildPlannerStatusMetadata({
                analysisDurationMs,
                stage: 'clarifying',
                userMessageId,
                questionKeys: selectedQuestions.map((question) => question.questionKey),
                startedAt,
                totalDurationMs:
                  Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : undefined,
              }),
            },
            trx
          );

          for (const question of selectedQuestions) {
            await PlanningSessionQuestions.createQuestion(
              {
                sessionId: sessionRecord.id,
                questionKey: question.questionKey,
                category: question.category,
                questionText: question.question,
                whyThisMatters: question.whyThisMatters,
                options: question.options,
                isRequired: question.required,
                isBlocking: question.blocking,
                askedInMessageId: processingMessage.id,
                askedAt: new Date(),
              },
              trx
            );
          }

          await PlanningRuns.updateRun(
            run.id,
            {
              finishedAt: new Date().toISOString(),
              metadata: {
                ...(run.metadata_json ?? {}),
                analysisDurationMs,
                clarificationTurnLimitReached,
                questionKeys: selectedQuestions.map((question) => question.questionKey),
                retryable: false,
                totalDurationMs:
                  Number.isFinite(startedAtMs)
                    ? Math.max(0, Date.now() - startedAtMs)
                    : undefined,
              },
              stage: 'clarifying',
              state: 'waiting_for_clarification',
            },
            trx
          );
          await PlanningSessions.updateSession(
            sessionRecord.id,
            {
              title: nextTitle,
              summary: nextSummary,
              plannerState: 'clarifying',
              context: nextContext,
              readiness: nextReadiness,
              clarificationTurnCount: sessionRecord.clarification_turn_count + 1,
            },
            trx
          );
        } else if (clarificationTurnLimitReached) {
          await PlanningRuns.updateRun(
            run.id,
            {
              errorMessage: buildClarificationLimitMessage(nextReadiness),
              finishedAt: new Date().toISOString(),
              metadata: {
                ...(run.metadata_json ?? {}),
                analysisDurationMs,
                retryable: false,
                totalDurationMs:
                  Number.isFinite(startedAtMs)
                    ? Math.max(0, Date.now() - startedAtMs)
                    : undefined,
              },
              stage: 'failed',
              state: 'failed',
            },
            trx
          );
          await PlanningSessionMessages.updateMessage(
            processingMessage.id,
            {
              content: buildClarificationLimitMessage(nextReadiness),
              status: 'failed',
              metadata: buildPlannerStatusMetadata({
                analysisDurationMs,
                stage: 'failed',
                userMessageId,
                retryable: false,
                startedAt,
                totalDurationMs:
                  Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : undefined,
              }),
            },
            trx
          );
          await PlanningSessions.updateSession(
            sessionRecord.id,
            {
              title: nextTitle,
              summary: nextSummary,
              plannerState: 'failed',
              context: nextContext,
              readiness: nextReadiness,
            },
            trx
          );
        } else {
          const clarificationRecoveryMessage =
            buildClarificationRecoveryMessage(nextReadiness);

          await PlanningRuns.updateRun(
            run.id,
            {
              errorMessage: clarificationRecoveryMessage,
              finishedAt: new Date().toISOString(),
              metadata: {
                ...(run.metadata_json ?? {}),
                analysisDurationMs,
                discardedCandidateQuestions,
                retryable: true,
                totalDurationMs:
                  Number.isFinite(startedAtMs)
                    ? Math.max(0, Date.now() - startedAtMs)
                    : undefined,
              },
              stage: 'failed',
              state: 'failed',
            },
            trx
          );
          await PlanningSessionMessages.updateMessage(
            processingMessage.id,
            {
              content: clarificationRecoveryMessage,
              status: 'failed',
              metadata: buildPlannerStatusMetadata({
                analysisDurationMs,
                stage: 'failed',
                discardedCandidateQuestions,
                userMessageId,
                error: clarificationRecoveryMessage,
                startedAt,
                totalDurationMs:
                  Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : undefined,
              }),
            },
            trx
          );
          if (discardedCandidateQuestions.length > 0) {
            console.error('[PLANNING_CLARIFICATION_RECOVERY]', {
              analysisDurationMs,
              discardedCandidateQuestions,
              readiness: nextReadiness,
              runId: run.id,
              sessionId: sessionRecord.id,
              userMessageId,
            });
          }
          await PlanningSessions.updateSession(
            sessionRecord.id,
            {
              title: nextTitle,
              summary: nextSummary,
              plannerState: 'failed',
              context: nextContext,
              readiness: nextReadiness,
            },
            trx
          );
        }
      });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to process the planning session';
    const structuredFailureDetails = extractStructuredFailureDetails(error);

    await persistPlanningFailure({
      analysisDurationMs,
      sessionId: sessionRecord.id,
      runId: run.id,
      processingMessageId: processingMessage.id,
      planDurationMs,
      title: latestTitle,
      summary: latestSummary,
      context: latestContext,
      readiness: latestReadiness,
      stage: latestStage,
      startedAt,
      userMessageId,
      errorMessage,
      discardedCandidateQuestions,
      ...structuredFailureDetails,
    });

    throw error;
  }

  const latestSession = await PlanningSessions.getSessionById(sessionRecord.id);

  if (!latestSession) {
    throw new BadRequestError('Planning session not found');
  }

  const detail = await buildPlanningSessionDetail(latestSession);
  await publishPlanningSessionUpdate(detail);
  return detail;
}

export async function processQueuedPlanningRun(runId: number) {
  const staleBefore = new Date(Date.now() - PROCESSING_STALE_AFTER_MS);
  const claimed = await db.transaction(async (trx) => {
    const lockedRun = await PlanningRuns.lockRunById(runId, trx);

    if (!lockedRun) {
      return null;
    }

    const isStaleRunning =
      lockedRun.state === 'running' &&
      new Date(lockedRun.updated_at).getTime() <= staleBefore.getTime();

    if (
      lockedRun.state !== 'queued' &&
      lockedRun.state !== 'failed' &&
      !isStaleRunning
    ) {
      return null;
    }

    const sessionRecord = await PlanningSessions.lockSessionById(lockedRun.session_id, trx);

    if (!sessionRecord) {
      throw new BadRequestError('Planning session not found');
    }

    const processingMessage = await PlanningSessionMessages.getMessageById(
      lockedRun.status_message_id,
      trx
    );

    if (!processingMessage) {
      throw new BadRequestError('Planning status message is missing');
    }

    const userMessageId =
      parsePlannerStatusMetadata(processingMessage.metadata_json).userMessageId ??
      lockedRun.trigger_message_id;

    const nextRun =
      (await PlanningRuns.updateRun(
        runId,
        {
          attemptCount: lockedRun.attempt_count + 1,
          errorMessage: null,
          finishedAt: null,
          metadata: {
            ...(lockedRun.metadata_json ?? {}),
            lastClaimedAt: new Date().toISOString(),
          },
          startedAt: lockedRun.started_at ?? new Date().toISOString(),
          stage: 'analyzing',
          state: 'running',
        },
        trx
      )) ?? lockedRun;

    const nextProcessingMessage =
      (await PlanningSessionMessages.updateMessage(
        processingMessage.id,
        {
          content: buildPlanningStatusMessage('analyzing'),
          status: 'processing',
          metadata: buildPlannerStatusMetadata({
            retryable: true,
            stage: 'analyzing',
            startedAt:
              parsePlannerStatusMetadata(processingMessage.metadata_json).startedAt ??
              new Date().toISOString(),
            userMessageId,
          }),
        },
        trx
      )) ?? processingMessage;

    await PlanningSessions.updateSession(
      lockedRun.session_id,
      {
        plannerState: 'analyzing',
      },
      trx
    );

    return {
      processingMessage: nextProcessingMessage,
      run: nextRun,
      sessionRecord,
    };
  });

  if (!claimed) {
    return null;
  }

  await publishPlanningSessionUpdateById(claimed.sessionRecord.id);

  return continuePlanningRun({
    processingMessage: claimed.processingMessage,
    run: claimed.run,
    sessionRecord: claimed.sessionRecord,
  });
}

export async function listOrganizationAiPlanningSessions({
  organizationId,
  boardId,
  sessionUserId,
}: {
  organizationId: number;
  boardId: number;
  sessionUserId: number;
}) {
  await requireBoardInOrganization(organizationId, boardId, sessionUserId);

  return PlanningSessions.listSessionsForUser({
    organizationId,
    boardId,
    userId: sessionUserId,
  });
}

export async function getOrganizationAiPlanningSession({
  organizationId,
  boardId,
  sessionId,
  sessionUserId,
}: {
  organizationId: number;
  boardId: number;
  sessionId: number;
  sessionUserId: number;
}) {
  const session = await requirePlanningSessionCreator(
    organizationId,
    boardId,
    sessionId,
    sessionUserId
  );

  return buildPlanningSessionDetail(session);
}

export async function createOrganizationAiPlanningSession({
  organizationId,
  boardId,
  sessionUserId,
  data,
}: {
  organizationId: number;
  boardId: number;
  sessionUserId: number;
  data: unknown;
}) {
  await requireBoardInOrganization(organizationId, boardId, sessionUserId);
  const parsedRequest = planningSessionCreateSchema.safeParse(data);
  const startedAt = new Date().toISOString();
  const executorKind = resolveDefaultPlanningExecutorKind();

  if (!parsedRequest.success) {
    throw new BadRequestError('Invalid planning session payload');
  }

  const request: PlanningSessionCreateRequest = parsedRequest.data;
  const content = request.content.trim();
  const created = await db.transaction(async (trx) => {
    const createdSession = await PlanningSessions.createSession(
      {
        organizationId,
        boardId,
        createdBy: sessionUserId,
        title: derivePlanningSessionTitle(content),
        summary: derivePlanningSessionSummary(content),
        originalPrompt: content,
        plannerState: 'queued',
        context: createEmptyPlanningContext(),
        readiness: createInitialPlanningReadiness(),
        clarificationTurnCount: 0,
      },
      trx
    );
    const userMessage = await PlanningSessionMessages.createMessage(
      {
        sessionId: createdSession.id,
        role: 'user',
        messageKind: 'user_input',
        content,
        sequenceNumber: 1,
        status: 'completed',
      },
      trx
    );

    const plannerStatusMessage = await PlanningSessionMessages.createMessage(
      {
        sessionId: createdSession.id,
        role: 'assistant',
        messageKind: 'planner_status',
        content: buildPlanningStatusMessage('queued'),
        sequenceNumber: 2,
        status: 'pending',
        metadata: buildPlannerStatusMetadata({
          stage: 'queued',
          startedAt,
          userMessageId: userMessage.id,
        }),
      },
      trx
    );

    const createdRun = await PlanningRuns.createRun(
      {
        executorKind,
        sessionId: createdSession.id,
        stage: 'queued',
        state: 'queued',
        statusMessageId: plannerStatusMessage.id,
        triggerMessageId: userMessage.id,
      },
      trx
    );

    return {
      run: createdRun,
      session: await PlanningSessions.getSessionById(createdSession.id, trx),
    };
  });

  if (!created.session) {
    throw new BadRequestError('Failed to create planning session');
  }

  const detail = await buildPlanningSessionDetail(created.session);
  await publishPlanningSessionUpdate(detail);
  await enqueuePlanningRun(created.run.id);
  return detail;
}

export async function createOrganizationAiPlanningSessionMessage({
  organizationId,
  boardId,
  sessionId,
  sessionUserId,
  data,
}: {
  organizationId: number;
  boardId: number;
  sessionId: number;
  sessionUserId: number;
  data: unknown;
}) {
  await requirePlanningSessionCreator(
    organizationId,
    boardId,
    sessionId,
    sessionUserId
  );
  const parsedRequest = planningSessionMessageSchema.safeParse(data);
  const startedAt = new Date().toISOString();
  const executorKind = resolveDefaultPlanningExecutorKind();

  if (!parsedRequest.success) {
    throw new BadRequestError('Invalid planning message payload');
  }

  const request: PlanningSessionMessageRequest = parsedRequest.data;
  const updated = await db.transaction(async (trx) => {
    const lockedSession = await PlanningSessions.lockSessionById(sessionId, trx);

    if (!lockedSession) {
      throw new BadRequestError('Planning session not found');
    }

    const currentQuestions = await PlanningSessionQuestions.listQuestionsForSession(
      sessionId,
      trx
    );
    const latestOpenClarificationQuestions = getLatestOpenClarificationQuestions(
      currentQuestions
    );
    const sequenceNumber = await PlanningSessionMessages.getNextSequenceNumber(sessionId, trx);
    let clarificationAnswers: PlanningQuestionAnswerInput[] = [];
    let clarificationBatchQuestions: PlanningQuestion[] = [];
    let userMessageContent = '';
    let userMessageMetadata: Record<string, unknown> | null = null;

    if (request.mode === 'freeform') {
      if (latestOpenClarificationQuestions.length > 0) {
        throw new BadRequestError(
          'Complete the clarification cards before sending another planning message'
        );
      }

      userMessageContent = request.content.trim();
    } else {
      clarificationBatchQuestions = resolveClarificationBatchForAnswers({
        answers: request.answers,
        questions: currentQuestions,
      });
      clarificationAnswers = validateClarificationBatchAnswers({
        answers: request.answers,
        openQuestions: clarificationBatchQuestions,
      });

      userMessageContent = buildClarificationAnswerSummary({
        questions: clarificationBatchQuestions,
        answers: clarificationAnswers,
      });
      userMessageMetadata = buildClarificationAnswerMetadata({
        questions: clarificationBatchQuestions,
        answers: clarificationAnswers,
      });
    }

    const userMessage = await PlanningSessionMessages.createMessage(
      {
        sessionId,
        role: 'user',
        messageKind: 'user_input',
        content: userMessageContent,
        sequenceNumber,
        status: 'completed',
        metadata: userMessageMetadata,
      },
      trx
    );

    if (request.mode === 'clarification_batch') {
      const clarificationBatchQuestionKeys = new Set(
        clarificationBatchQuestions.map((question) => question.question_key)
      );
      const supersededQuestionKeys = currentQuestions
        .filter((question) => question.status === 'open')
        .filter((question) => !clarificationBatchQuestionKeys.has(question.question_key))
        .map((question) => question.question_key);

      await PlanningSessionQuestions.supersedeOpenQuestions(
        sessionId,
        supersededQuestionKeys,
        trx
      );
      await PlanningSessionQuestions.answerQuestions(
        sessionId,
        clarificationAnswers,
        userMessage.id,
        trx
      );
    }

    const plannerStatusMessage = await PlanningSessionMessages.createMessage(
      {
        sessionId,
        role: 'assistant',
        messageKind: 'planner_status',
        content: buildPlanningStatusMessage('queued'),
        sequenceNumber: sequenceNumber + 1,
        status: 'pending',
        metadata: buildPlannerStatusMetadata({
          stage: 'queued',
          startedAt,
          userMessageId: userMessage.id,
        }),
      },
      trx
    );
    const createdRun = await PlanningRuns.createRun(
      {
        executorKind,
        sessionId,
        stage: 'queued',
        state: 'queued',
        statusMessageId: plannerStatusMessage.id,
        triggerMessageId: userMessage.id,
      },
      trx
    );
    await PlanningSessions.updateSession(
      sessionId,
      {
        plannerState: 'queued',
        planArtifact: null,
      },
      trx
    );

    return {
      run: createdRun,
      session: await PlanningSessions.getSessionById(sessionId, trx),
    };
  });

  if (!updated.session) {
    throw new BadRequestError('Planning session not found');
  }

  const detail = await buildPlanningSessionDetail(updated.session);
  await publishPlanningSessionUpdate(detail);
  await enqueuePlanningRun(updated.run.id);
  return detail;
}

export async function processOrganizationAiPlanningSession({
  organizationId,
  boardId,
  sessionId,
  sessionUserId,
}: {
  organizationId: number;
  boardId: number;
  sessionId: number;
  sessionUserId: number;
}) {
  await requirePlanningSessionCreator(
    organizationId,
    boardId,
    sessionId,
    sessionUserId
  );
  const sessionRecord = await PlanningSessions.getSessionById(sessionId);

  if (!sessionRecord) {
    throw new BadRequestError('Planning session not found');
  }

  const latestRun = await PlanningRuns.getLatestRunForSession(sessionId);

  if (!latestRun) {
    return buildPlanningSessionDetail(sessionRecord);
  }

  const isStaleRunning =
    latestRun.state === 'running' &&
    Date.now() - new Date(latestRun.updated_at).getTime() >= PROCESSING_STALE_AFTER_MS;

  if (latestRun.state === 'completed' || latestRun.state === 'waiting_for_clarification') {
    return buildPlanningSessionDetail(sessionRecord);
  }

  if (!isPlanningRunRetryable(latestRun) || (latestRun.state === 'running' && !isStaleRunning)) {
    return buildPlanningSessionDetail(sessionRecord);
  }

  const detail = await requeuePlanningRun({
    run: latestRun,
  });

  return detail ?? buildPlanningSessionDetail(sessionRecord);
}

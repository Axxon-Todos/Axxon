// Runs structured planning-stage completions so planning sessions stay schema-driven instead of freeform chat.
import { z } from 'zod';

import { completeAiStructuredJson } from '@/lib/ai/service';
import type { AiChatMessage } from '@/lib/types/aiTypes';
import type {
  PlanningContext,
  PlanningTechnicalDecision,
  PlanningPlanArtifact,
  PlanningQuestion,
  PlanningQuestionCandidate,
  PlanningReadiness,
  PlanningTurnAnalysis,
} from '@/lib/types/organizationAiPlanningTypes';

const complexitySchema = z.enum(['low', 'medium', 'high', 'very_high']);

const MAX_PLANNER_ANSWER_NOTE_LENGTH = 500;

const planningStringArrayFieldMaxLengths = {
  acceptanceCriteria: 240,
  affectedAreas: 120,
  assumptions: 240,
  blockingUnknowns: 240,
  constraints: 240,
  dependencies: 240,
  inScope: 240,
  knownRequirements: 240,
  outOfScope: 240,
  resolvedQuestionKeys: 80,
  risks: 240,
  successCriteria: 240,
  unresolvedUnknowns: 240,
} as const;

const planningContextPatchStringArrayFieldMaxLengths = {
  inScope: 240,
  outOfScope: 240,
  assumptions: 240,
  constraints: 240,
  acceptanceCriteria: 240,
  knownRequirements: 240,
  unresolvedUnknowns: 240,
  blockingUnknowns: 240,
  affectedAreas: 120,
  risks: 240,
  dependencies: 240,
} as const;

const planningPlanArtifactStringArrayFieldMaxLengths = {
  assumptions: 240,
  constraints: 240,
  affectedAreas: 120,
  risks: 240,
  successCriteria: 240,
  openQuestions: 240,
} as const;

function readLooseString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of [
    'question',
    'label',
    'title',
    'name',
    'summary',
    'text',
    'description',
    'reason',
    'risk',
    'mitigation',
    'requirementKey',
    'questionKey',
    'optionKey',
    'key',
    'value',
    'id',
  ]) {
    const candidateValue = readLooseString(record[key]);

    if (candidateValue) {
      return candidateValue;
    }
  }

  return null;
}

function normalizeBoundedString(value: unknown, maxLength: number) {
  const normalizedValue = readLooseString(value);

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return normalizedValue.slice(0, maxLength).trim();
}

function isPlannerPlaceholderListEntry(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/\.+$/g, '');

  return (
    normalizedValue === 'none' ||
    normalizedValue === 'n/a' ||
    normalizedValue === 'not applicable' ||
    normalizedValue === 'no known blocking unknowns' ||
    normalizedValue === 'no known blocking unknowns at this stage' ||
    normalizedValue === 'no blocking unknowns' ||
    normalizedValue === 'no blocking unknowns remain' ||
    normalizedValue === 'no known unresolved unknowns' ||
    normalizedValue === 'no known unresolved unknowns at this stage' ||
    normalizedValue === 'no unresolved unknowns' ||
    normalizedValue === 'no unresolved unknowns remain'
  );
}

function normalizeLooseStringArray(value: unknown, maxLength = 240) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .map((entry) => normalizeBoundedString(entry, maxLength))
    .filter(
      (entry): entry is string =>
        typeof entry === 'string' && !isPlannerPlaceholderListEntry(entry)
    );
}

function normalizeLooseStringList(value: unknown, maxLength = 240) {
  if (Array.isArray(value)) {
    return normalizeLooseStringArray(value, maxLength) ?? [];
  }

  const normalizedValue = normalizeBoundedString(value, maxLength);
  return normalizedValue && !isPlannerPlaceholderListEntry(normalizedValue)
    ? [normalizedValue]
    : [];
}

function normalizeStringArrayFields<T extends Record<string, number>>(
  value: unknown,
  fieldMaxLengths: T
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const normalizedValue = {
    ...(value as Record<string, unknown>),
  };

  for (const [fieldName, maxLength] of Object.entries(fieldMaxLengths)) {
    if (fieldName in normalizedValue) {
      normalizedValue[fieldName] = normalizeLooseStringArray(
        normalizedValue[fieldName],
        maxLength
      );
    }
  }

  return normalizedValue;
}

function normalizePlanningQuestionOption(value: unknown, index: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const label =
    normalizeBoundedString(record.label ?? record.name, 120) ?? `Option ${index + 1}`;
  const description =
    normalizeBoundedString(record.description ?? record.summary ?? label, 220) ?? label;

  return {
    ...record,
    optionKey:
      normalizeBoundedString(record.optionKey ?? record.key ?? label, 80) ??
      `option-${index + 1}`,
    label,
    description,
    isRecommended: record.isRecommended === true,
  };
}

function normalizePlanningQuestionCandidate(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const normalizedValue = {
    ...(value as Record<string, unknown>),
  };
  const questionText =
    readLooseString(normalizedValue.question) ?? readLooseString(normalizedValue.label);

  if (questionText) {
    normalizedValue.question = normalizeBoundedString(questionText, 280);
  }

  const questionKey =
    readLooseString(normalizedValue.questionKey) ??
    readLooseString(normalizedValue.key) ??
    readLooseString(normalizedValue.id);

  if (questionKey) {
    normalizedValue.questionKey = normalizeBoundedString(questionKey, 80);
  }

  const whyThisMatters =
    normalizeBoundedString(normalizedValue.whyThisMatters, 220) ??
    normalizeBoundedString(normalizedValue.description, 220) ??
    normalizeBoundedString(normalizedValue.reason, 220);

  if (whyThisMatters) {
    normalizedValue.whyThisMatters = whyThisMatters;
  }

  if (Array.isArray(normalizedValue.options)) {
    normalizedValue.options = normalizedValue.options.map((option, index) =>
      normalizePlanningQuestionOption(option, index)
    );
  }

  return normalizedValue;
}

function normalizeComplexity(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase().replace(/\s+/g, '_');

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeTechnicalDecision(value: unknown) {
  if (typeof value === 'string') {
    const normalizedValue = normalizeBoundedString(value, 240);

    if (!normalizedValue) {
      return null;
    }

    return {
      area: 'implementation',
      choice: normalizedValue,
      rationale: 'Assumed by the planning model based on the provided context.',
      source: 'assumed',
    } satisfies PlanningTechnicalDecision;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const area =
    normalizeBoundedString(record.area, 120) ??
    normalizeBoundedString(record.domain, 120) ??
    normalizeBoundedString(record.category, 120);
  const choice =
    normalizeBoundedString(record.choice, 240) ??
    normalizeBoundedString(record.decision, 240) ??
    normalizeBoundedString(record.selectedOption, 240);
  const rationale =
    normalizeBoundedString(record.rationale, 320) ??
    normalizeBoundedString(record.reason, 320) ??
    normalizeBoundedString(record.description, 320);
  const source =
    record.source === 'explicit' ||
    record.source === 'clarified' ||
    record.source === 'assumed'
      ? record.source
      : 'assumed';

  if (!area || !choice || !rationale) {
    return null;
  }

  return {
    area,
    choice,
    rationale,
    source,
  } satisfies PlanningTechnicalDecision;
}

function normalizeTechnicalDecisionCollection(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const decisions: PlanningTechnicalDecision[] = [];

  for (const entry of value) {
    const normalizedEntry = normalizeTechnicalDecision(entry);

    if (!normalizedEntry) {
      continue;
    }

    const key = `${normalizedEntry.area.toLowerCase()}::${normalizedEntry.choice.toLowerCase()}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    decisions.push(normalizedEntry);
  }

  return decisions;
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value;
  }

  if (value > 1 && value <= 10) {
    return value / 10;
  }

  if (value > 10 && value <= 100) {
    return value / 100;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function normalizeRecommendedNextAction(value: unknown) {
  if (typeof value !== 'string') {
    return 'ask_clarification';
  }

  const normalizedValue = value.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (
    normalizedValue === 'generate_plan' ||
    normalizedValue === 'ready_to_plan' ||
    normalizedValue === 'plan' ||
    normalizedValue === 'generate' ||
    normalizedValue === 'final_plan' ||
    normalizedValue === 'plan_ready'
  ) {
    return 'generate_plan';
  }

  if (
    normalizedValue === 'ask_clarification' ||
    normalizedValue === 'clarify' ||
    normalizedValue === 'ask_questions' ||
    normalizedValue === 'continue_clarifying' ||
    normalizedValue === 'continue_clarification' ||
    normalizedValue === 'define_acceptance_criteria' ||
    normalizedValue === 'clarification_needed'
  ) {
    return 'ask_clarification';
  }

  return 'ask_clarification';
}

function pickNormalizedStringArray(maxLength: number, ...values: unknown[]) {
  let fallbackValue: string[] | null = null;

  for (const value of values) {
    const normalizedValue = normalizeLooseStringArray(value, maxLength);

    if (Array.isArray(normalizedValue)) {
      if (normalizedValue.length > 0) {
        return normalizedValue;
      }

      fallbackValue ??= normalizedValue;
    }
  }

  return fallbackValue ?? [];
}

function normalizePlanningTurnAnalysis(value: unknown) {
  const normalizedValue = normalizeStringArrayFields(
    value,
    planningStringArrayFieldMaxLengths
  );

  if (!normalizedValue || typeof normalizedValue !== 'object' || Array.isArray(normalizedValue)) {
    return normalizedValue;
  }

  const record = normalizedValue as Record<string, unknown>;
  const normalizedContextPatch = normalizeStringArrayFields(
    record.contextPatch,
    planningContextPatchStringArrayFieldMaxLengths
  );
  const contextPatchRecord =
    normalizedContextPatch &&
    typeof normalizedContextPatch === 'object' &&
    !Array.isArray(normalizedContextPatch)
      ? (normalizedContextPatch as Record<string, unknown>)
      : {};

  return {
    ...record,
    title: normalizeBoundedString(record.title ?? record.sessionTitle, 120),
    summary: normalizeBoundedString(record.summary, 220),
    knownRequirements: pickNormalizedStringArray(
      240,
      record.knownRequirements,
      contextPatchRecord.knownRequirements
    ),
    unresolvedUnknowns: pickNormalizedStringArray(
      240,
      record.unresolvedUnknowns,
      contextPatchRecord.unresolvedUnknowns,
      contextPatchRecord.blockingUnknowns
    ),
    blockingUnknowns: pickNormalizedStringArray(
      240,
      record.blockingUnknowns,
      contextPatchRecord.blockingUnknowns,
      contextPatchRecord.unresolvedUnknowns
    ),
    contextPatch: {
      ...contextPatchRecord,
      technicalDecisions: normalizeTechnicalDecisionCollection(
        contextPatchRecord.technicalDecisions ??
          record.technicalDecisions ??
          record.defaultDecisions
      ),
    },
    resolvedQuestionKeys: pickNormalizedStringArray(80, record.resolvedQuestionKeys),
    candidateQuestions: Array.isArray(record.candidateQuestions)
      ? record.candidateQuestions.slice(0, 3)
      : [],
    confidence: typeof record.confidence === 'number' ? record.confidence : 0,
  };
}

function normalizeArtifactId(value: unknown, fallbackPrefix: string, index: number) {
  const sourceValue = readLooseString(value) ?? `${fallbackPrefix}-${index + 1}`;
  const normalizedValue = sourceValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return normalizedValue || `${fallbackPrefix}-${index + 1}`;
}

function normalizePriority(value: unknown) {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }

  if (typeof value !== 'string') {
    return 'medium';
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'low' || normalizedValue === 'medium' || normalizedValue === 'high') {
    return normalizedValue;
  }

  return 'medium';
}

function normalizePlanTask(value: unknown, index: number) {
  if (typeof value === 'string') {
    const title = value.trim() || `Task ${index + 1}`;

    return {
      id: normalizeArtifactId(title, 'task', index),
      title,
      description: title,
      type: 'implementation',
      priority: 'medium',
      dependencyIds: [],
      acceptanceCriteria: [],
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const title =
    normalizeBoundedString(record.title, 200) ??
    normalizeBoundedString(record.taskTitle, 200) ??
    normalizeBoundedString(record.taskName, 200) ??
    normalizeBoundedString(record.name, 200) ??
    `Task ${index + 1}`;
  const normalizedAcceptanceCriteria = normalizeLooseStringArray(
    record.acceptanceCriteria ?? record.acceptance_criteria,
    240
  );
  const acceptanceCriteria = Array.isArray(normalizedAcceptanceCriteria)
    ? normalizedAcceptanceCriteria
    : normalizeLooseStringList(record.acceptanceCriteria ?? record.acceptance_criteria, 240);

  return {
    ...record,
    id: normalizeArtifactId(record.id ?? record.taskId ?? title, 'task', index),
    title,
    description:
      normalizeBoundedString(record.description, 600) ??
      normalizeBoundedString(record.summary, 600) ??
      title,
    type: normalizeBoundedString(record.type, 80) ?? 'implementation',
    priority: normalizePriority(record.priority),
    dependencyIds: normalizeLooseStringList(
      record.dependencyIds ?? record.dependencies,
      80
    ),
    acceptanceCriteria,
  };
}

function normalizePlanPhase(value: unknown, index: number, fallbackTitle?: string) {
  if (Array.isArray(value)) {
    const title = fallbackTitle?.trim() || `Phase ${index + 1}`;

    return {
      id: normalizeArtifactId(title, 'phase', index),
      title,
      summary: `Complete ${title.toLowerCase()}.`,
      tasks: value.map((task, taskIndex) => normalizePlanTask(task, taskIndex)),
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const title =
    normalizeBoundedString(record.title, 200) ??
    normalizeBoundedString(record.phaseTitle, 200) ??
    normalizeBoundedString(record.phaseName, 200) ??
    normalizeBoundedString(record.name, 200) ??
    fallbackTitle?.trim() ??
    `Phase ${index + 1}`;
  const normalizedTasks = Array.isArray(record.tasks)
    ? record.tasks.map((task, taskIndex) => normalizePlanTask(task, taskIndex))
    : Array.isArray(record.items)
      ? record.items.map((task, taskIndex) => normalizePlanTask(task, taskIndex))
      : [];

  return {
    ...record,
    id: normalizeArtifactId(record.id ?? record.phaseId ?? title, 'phase', index),
    title,
    summary:
      normalizeBoundedString(record.summary, 500) ??
      normalizeBoundedString(record.description, 500) ??
      `Complete ${title.toLowerCase()}.`,
    tasks: normalizedTasks,
  };
}

function normalizePlanPhaseCollection(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((phase, index) => normalizePlanPhase(phase, index));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).map(
    ([phaseKey, phaseValue], index) => normalizePlanPhase(phaseValue, index, phaseKey)
  );
}

function normalizePlanScope(value: unknown) {
  if (Array.isArray(value)) {
    return {
      inScope: normalizeLooseStringArray(value) ?? [],
      outOfScope: [],
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;

  return {
    ...record,
    inScope:
      normalizeLooseStringArray(record.inScope ?? record.features ?? record.items, 240) ?? [],
    outOfScope: normalizeLooseStringArray(record.outOfScope, 240) ?? [],
  };
}

function normalizePlanArtifact(value: unknown) {
  const normalizedValue = normalizeStringArrayFields(
    value,
    planningPlanArtifactStringArrayFieldMaxLengths
  );

  if (!normalizedValue || typeof normalizedValue !== 'object' || Array.isArray(normalizedValue)) {
    return normalizedValue;
  }

  const record = normalizedValue as Record<string, unknown>;

  return {
    ...record,
    summary: normalizeBoundedString(record.summary, 1200),
    objective: normalizeBoundedString(record.objective, 1200),
    scope: normalizePlanScope(record.scope),
    assumptions: normalizeLooseStringArray(record.assumptions, 240) ?? [],
    constraints: normalizeLooseStringArray(record.constraints, 240) ?? [],
    affectedAreas: normalizeLooseStringArray(record.affectedAreas, 120) ?? [],
    technicalDecisions: normalizeTechnicalDecisionCollection(
      record.technicalDecisions ??
        record.architectureDecisions ??
        record.stackDecisions
    ),
    implementationPhases: normalizePlanPhaseCollection(
      record.implementationPhases ?? record.phases
    ),
    risks: normalizeLooseStringArray(record.risks, 240) ?? [],
    successCriteria: normalizeLooseStringArray(record.successCriteria, 240) ?? [],
    openQuestions: normalizeLooseStringArray(record.openQuestions, 240) ?? [],
  };
}

const planningContextPatchSchema = z.preprocess(
  (value) =>
    normalizeStringArrayFields(value, planningContextPatchStringArrayFieldMaxLengths),
  z
    .object({
      objective: z.string().trim().min(1).max(500).nullable().optional(),
      summary: z.string().trim().min(1).max(1000).nullable().optional(),
      targetOutcome: z.string().trim().min(1).max(1000).nullable().optional(),
      inScope: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
      outOfScope: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
      assumptions: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
      constraints: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
      acceptanceCriteria: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
      knownRequirements: z.array(z.string().trim().min(1).max(240)).max(25).optional(),
      unresolvedUnknowns: z.array(z.string().trim().min(1).max(240)).max(25).optional(),
      blockingUnknowns: z.array(z.string().trim().min(1).max(240)).max(25).optional(),
      affectedAreas: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      risks: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
      dependencies: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
      technicalDecisions: z
        .array(
          z.object({
            area: z.string().trim().min(1).max(120),
            choice: z.string().trim().min(1).max(240),
            rationale: z.string().trim().min(1).max(320),
            source: z.enum(['explicit', 'clarified', 'assumed']),
          })
        )
        .max(12)
        .optional(),
      estimatedComplexity: z.preprocess(
        normalizeComplexity,
        complexitySchema.nullable().optional()
      ),
      planningConfidence: z.number().min(0).max(1).optional(),
    })
    .passthrough()
);

const planningQuestionCandidateSchema = z.preprocess(
  normalizePlanningQuestionCandidate,
  z.object({
    options: z
      .array(
        z.object({
          optionKey: z.preprocess(
            (value) => (typeof value === 'string' ? value : ''),
            z.string().trim().min(1).max(80)
          ),
          label: z.string().trim().min(1).max(120),
          description: z.string().trim().min(1).max(220),
          isRecommended: z.preprocess((value) => value === true, z.boolean()).optional(),
        })
      )
      .length(3),
    questionKey: z.preprocess(
      (value) => (typeof value === 'string' ? value : ''),
      z.string().trim().max(80)
    ),
    question: z.preprocess(
      (value) => readLooseString(value) ?? '',
      z.string().trim().min(1).max(280)
    ),
    category: z.preprocess(
      (value) => (typeof value === 'string' ? value : 'scope'),
      z.enum([
        'scope',
        'technical',
        'constraints',
        'dependencies',
        'acceptance_criteria',
        'priority',
        'ux',
        'rollout',
      ])
    ),
    whyThisMatters: z.preprocess(
      (value) =>
        typeof value === 'string'
          ? value
          : 'Need this detail to build a reliable implementation plan.',
      z.string().trim().min(1).max(220)
    ),
    required: z.preprocess((value) => value === true, z.boolean()),
    blocking: z.preprocess((value) => value === true, z.boolean()),
  })
);

const planningTurnAnalysisSchema = z.preprocess(
  normalizePlanningTurnAnalysis,
  z.object({
    title: z.string().trim().min(1).max(120).nullable(),
    summary: z.string().trim().min(1).max(220).nullable(),
    contextPatch: planningContextPatchSchema,
    knownRequirements: z.array(z.string().trim().min(1).max(240)).max(25),
    unresolvedUnknowns: z.array(z.string().trim().min(1).max(240)).max(25),
    blockingUnknowns: z.array(z.string().trim().min(1).max(240)).max(25),
    resolvedQuestionKeys: z.array(z.string().trim().min(1).max(80)).max(25),
    candidateQuestions: z.array(planningQuestionCandidateSchema).max(3),
    confidence: z.preprocess(normalizeConfidence, z.number().min(0).max(1)),
    recommendedNextAction: z.preprocess(
      normalizeRecommendedNextAction,
      z.enum(['ask_clarification', 'generate_plan'])
    ),
  })
);

const planningClarificationCandidateCollectionSchema = z.object({
  candidateQuestions: z.array(planningQuestionCandidateSchema).min(1).max(3),
});

const planningPlanArtifactSchema = z.preprocess(
  normalizePlanArtifact,
  z.object({
    summary: z.string().trim().min(1).max(1200),
    objective: z.string().trim().min(1).max(1200),
    scope: z.object({
      inScope: z.array(z.string().trim().min(1).max(240)).max(25),
      outOfScope: z.array(z.string().trim().min(1).max(240)).max(25),
    }),
    assumptions: z.array(z.string().trim().min(1).max(240)).max(25),
    constraints: z.array(z.string().trim().min(1).max(240)).max(25),
    affectedAreas: z.array(z.string().trim().min(1).max(120)).max(25),
    technicalDecisions: z
      .array(
        z.object({
          area: z.string().trim().min(1).max(120),
          choice: z.string().trim().min(1).max(240),
          rationale: z.string().trim().min(1).max(320),
          source: z.enum(['explicit', 'clarified', 'assumed']),
        })
      )
      .max(12),
    implementationPhases: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          title: z.string().trim().min(1).max(200),
          summary: z.string().trim().min(1).max(500),
          tasks: z
            .array(
              z.object({
                id: z.string().trim().min(1).max(80),
                title: z.string().trim().min(1).max(200),
                description: z.string().trim().min(1).max(600),
                type: z.string().trim().min(1).max(80),
                priority: z.enum(['low', 'medium', 'high']),
                dependencyIds: z.array(z.string().trim().min(1).max(80)).max(10),
                acceptanceCriteria: z.array(z.string().trim().min(1).max(240)).max(10),
              })
            )
            .min(1)
            .max(12),
        })
      )
      .min(1)
      .max(8),
    risks: z.array(z.string().trim().min(1).max(240)).max(20),
    successCriteria: z.array(z.string().trim().min(1).max(240)).max(20),
    openQuestions: z.array(z.string().trim().min(1).max(240)).max(20),
  })
);

const PLANNING_ANALYSIS_SYSTEM_PROMPT = [
  'You are Axxon Planning Agent.',
  'You are not a general assistant.',
  'Analyze the planning session state and return JSON only.',
  'Your job is to extract requirements, identify unknowns, determine blocking gaps, and propose only the highest-value clarification questions.',
  'Default non-critical implementation choices into concrete technicalDecisions instead of leaving them implied.',
  'Only treat an unknown as blocking when it materially changes architecture, deployment, integration contracts, security boundaries, or high-risk implementation paths.',
  'Ask at most 3 candidate questions in total and focus on blocking unknowns first.',
  'Every candidate question must be answerable as a guided card with exactly 3 mutually exclusive options.',
  'Mark exactly 1 option per question as isRecommended: true, using the strongest default path when one exists.',
  'Each option must be concise, concrete, and implementation-relevant.',
  'Do not include a none-of-the-above option because the application adds that automatically.',
  'Never ask vague questions such as "tell me more".',
  'Return a plain JSON object with no markdown fences.',
  'Set confidence to a decimal between 0 and 1.',
  'If a clarification question is already answered, list it in resolvedQuestionKeys and do not repeat it as unresolved, blocking, or a new candidate question.',
  'Use stable lower-kebab-case questionKey values.',
  'Do not generate a final implementation plan in this stage.',
].join(' ');

const PLANNING_CLARIFICATION_SYSTEM_PROMPT = [
  'You are Axxon Planning Agent.',
  'Return JSON only.',
  'Generate only the next clarification questions needed to unblock planning.',
  'Do not generate a final implementation plan in this stage.',
  'Do not repeat questions that are already answered or currently open.',
  'Return a plain JSON object with candidateQuestions only.',
  'Return 1 to 3 candidate questions.',
  'Each candidate question must include exactly 3 mutually exclusive options and exactly one recommended option.',
].join(' ');

const PLANNING_ARTIFACT_SYSTEM_PROMPT = [
  'You are Axxon Planning Agent.',
  'Return a structured implementation plan as JSON only.',
  'Do not ask follow-up questions in this stage.',
  'Return a plain JSON object with no markdown fences.',
  'Do not leave major framework or stack decisions implied when later tasks depend on them.',
  'Record concrete stack and framework decisions in technicalDecisions with a short rationale and whether each came from explicit input, clarification, or model assumption.',
  'Preserve scope boundaries, split the work into meaningful phases, and keep tasks implementation-oriented.',
  'Use implementationPhases as an array of phase objects with id, title, summary, and tasks.',
  'Each task must include id, title, description, type, priority, dependencyIds, and acceptanceCriteria.',
  'openQuestions must be an array of plain strings, not objects.',
  'Each task must include concrete acceptanceCriteria.',
].join(' ');

function buildPlanningPayload({
  sessionTitle,
  originalPrompt,
  context,
  readiness,
  questions,
  messages,
  extraInstructions,
}: {
  sessionTitle: string;
  originalPrompt: string;
  context: PlanningContext;
  readiness: PlanningReadiness;
  questions: PlanningQuestion[];
  messages: Array<Record<string, unknown>>;
  extraInstructions?: string;
}) {
  return JSON.stringify(
    {
      sessionTitle,
      originalPrompt,
      context,
      readiness,
      questions: questions.map((question) => ({
        questionKey: question.question_key,
        category: question.category,
        question: question.question_text,
        whyThisMatters: question.why_this_matters,
        options: question.options_json.map((option) => ({
          optionKey: option.optionKey,
          label: option.label,
          description: option.description,
          isRecommended: option.isRecommended === true,
        })),
        selectedOptionKey: question.selected_option_key,
        selectedOption:
          question.options_json.find(
            (option) => option.optionKey === question.selected_option_key
          ) ?? null,
        answerNote: normalizeBoundedString(
          question.answer_note,
          MAX_PLANNER_ANSWER_NOTE_LENGTH
        ),
        status: question.status,
        required: question.is_required,
        blocking: question.is_blocking,
      })),
      messages,
      extraInstructions: extraInstructions ?? null,
    },
    null,
    2
  );
}

export async function analyzePlanningTurn({
  sessionTitle,
  originalPrompt,
  context,
  readiness,
  questions,
  messages,
}: {
  sessionTitle: string;
  originalPrompt: string;
  context: PlanningContext;
  readiness: PlanningReadiness;
  questions: PlanningQuestion[];
  messages: Array<Record<string, unknown>>;
}): Promise<PlanningTurnAnalysis> {
  return completeAiStructuredJson<PlanningTurnAnalysis>({
    messages: [
      {
        role: 'system',
        content: PLANNING_ANALYSIS_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: buildPlanningPayload({
          sessionTitle,
          originalPrompt,
          context,
          readiness,
          questions,
          messages,
          extraInstructions:
            'Return JSON with title, summary, contextPatch, knownRequirements, unresolvedUnknowns, blockingUnknowns, resolvedQuestionKeys, candidateQuestions, confidence, and recommendedNextAction. Use confidence on a 0 to 1 decimal scale. Include contextPatch.technicalDecisions for concrete defaults or chosen stack decisions. Each candidate question must include exactly 3 options with optionKey, label, description, and exactly one isRecommended: true option. Do not list already answered clarification questions as unresolved or blocking.',
        }),
      },
    ] satisfies AiChatMessage[],
    schema: planningTurnAnalysisSchema as z.ZodType<PlanningTurnAnalysis>,
    failureMessage: 'Failed to analyze the planning session',
    fallbackUserMessage:
      'Your response did not match the required JSON schema. Return only valid JSON for the planning-turn analysis shape.',
  });
}

export async function generatePlanningClarificationQuestions({
  sessionTitle,
  originalPrompt,
  context,
  readiness,
  questions,
  messages,
}: {
  sessionTitle: string;
  originalPrompt: string;
  context: PlanningContext;
  readiness: PlanningReadiness;
  questions: PlanningQuestion[];
  messages: Array<Record<string, unknown>>;
}): Promise<PlanningQuestionCandidate[]> {
  const result = await completeAiStructuredJson<{
    candidateQuestions: PlanningQuestionCandidate[];
  }>({
    messages: [
      {
        role: 'system',
        content: PLANNING_CLARIFICATION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: buildPlanningPayload({
          sessionTitle,
          originalPrompt,
          context,
          readiness,
          questions,
          messages,
          extraInstructions:
            'Return JSON with candidateQuestions only. Focus strictly on the still-unresolved blocking unknowns. Do not repeat already answered or currently open clarification questions. Each candidate question must include exactly 3 options with optionKey, label, description, and exactly one isRecommended: true option.',
        }),
      },
    ] satisfies AiChatMessage[],
    schema:
      planningClarificationCandidateCollectionSchema as z.ZodType<{
        candidateQuestions: PlanningQuestionCandidate[];
      }>,
    failureMessage: 'Failed to generate clarification questions',
    fallbackUserMessage:
      'Your response did not match the required JSON schema. Return only valid JSON with candidateQuestions for the next clarification cards.',
  });

  return result.candidateQuestions;
}

export async function generatePlanningArtifact({
  sessionTitle,
  originalPrompt,
  context,
  readiness,
  questions,
  messages,
}: {
  sessionTitle: string;
  originalPrompt: string;
  context: PlanningContext;
  readiness: PlanningReadiness;
  questions: PlanningQuestion[];
  messages: Array<Record<string, unknown>>;
}): Promise<PlanningPlanArtifact> {
  return completeAiStructuredJson<PlanningPlanArtifact>({
    messages: [
      {
        role: 'system',
        content: PLANNING_ARTIFACT_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: buildPlanningPayload({
          sessionTitle,
          originalPrompt,
          context,
          readiness,
          questions,
          messages,
          extraInstructions:
            'Return JSON with summary, objective, scope, assumptions, constraints, affectedAreas, technicalDecisions, implementationPhases, risks, successCriteria, and openQuestions. Use implementationPhases as an array of phase objects with id, title, summary, and tasks. Each task must include id, title, description, type, priority, dependencyIds, and acceptanceCriteria. technicalDecisions must be an array of objects with area, choice, rationale, and source. openQuestions must be an array of plain strings.',
        }),
      },
    ] satisfies AiChatMessage[],
    schema: planningPlanArtifactSchema as z.ZodType<PlanningPlanArtifact>,
    failureMessage: 'Failed to generate the planning artifact',
    fallbackUserMessage:
      'Your response did not match the required JSON schema. Return only valid JSON for the final planning artifact.',
  });
}

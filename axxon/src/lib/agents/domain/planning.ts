// Contains deterministic planning-readiness rules and clarification-question normalization helpers.
import type {
  AgentClarificationAnswer,
  AgentPlanningContext,
  AgentPlanningDecisionReason,
  AgentPlanningReadiness,
  AgentPlanningTurnAnalysis,
  AgentQuestion,
  AgentQuestionCategory,
  AgentQuestionOption,
  AgentTechnicalDecision,
} from './contracts';

export const AGENT_PLANNING_CONFIDENCE_THRESHOLD = 0.7;
export const MAX_AGENT_QUESTIONS_PER_TURN = 3;
export const NONE_OF_THE_ABOVE_OPTION: AgentQuestionOption = {
  optionKey: 'none-of-the-above',
  label: 'None of the above',
  description: 'The right answer is not listed; add a note if needed.',
  isRecommended: false,
};

// Creates the first planning context snapshot for a newly queued planning run.
export function createEmptyPlanningContext(): AgentPlanningContext {
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

// Creates a conservative readiness snapshot before the model has analyzed the run.
export function createInitialPlanningReadiness(): AgentPlanningReadiness {
  return {
    objectiveClear: false,
    scopeBounded: false,
    hasAcceptanceCriteria: false,
    knownRequirements: [],
    unresolvedUnknowns: [],
    blockingUnknowns: [],
    confidence: 0,
    recommendedNextAction: 'ask_questions',
    reasonSummary: ['Waiting for the first planning analysis.'],
  };
}

// Normalizes identifiers into stable lower-kebab-case values for dedupe and answer matching.
export function normalizeAgentQuestionKey(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'clarification-question';
}

function normalizeQuestionText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function dedupeStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalizedValue = value?.trim();
    if (!normalizedValue) continue;

    const normalizedPlaceholder = normalizedValue.toLowerCase().replace(/\.+$/g, '');
    if (
      normalizedPlaceholder === 'none' ||
      normalizedPlaceholder === 'n/a' ||
      normalizedPlaceholder === 'not applicable' ||
      normalizedPlaceholder === 'no blocking unknowns' ||
      normalizedPlaceholder === 'no unresolved unknowns'
    ) {
      continue;
    }

    const dedupeKey = normalizedValue.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    result.push(normalizedValue);
  }

  return result;
}

function mergeStrings(currentValues: string[], nextValues?: string[]) {
  if (!nextValues) return currentValues;
  return dedupeStrings([...currentValues, ...nextValues]);
}

function mergeTechnicalDecisions(
  currentValues: AgentTechnicalDecision[],
  nextValues?: AgentTechnicalDecision[]
) {
  if (!nextValues) return currentValues;
  const seen = new Set<string>();
  const merged: AgentTechnicalDecision[] = [];

  for (const decision of [...currentValues, ...nextValues]) {
    const area = decision.area.trim();
    const choice = decision.choice.trim();
    const rationale = decision.rationale.trim();
    if (!area || !choice || !rationale) continue;

    const key = `${area.toLowerCase()}::${choice.toLowerCase()}`;
    if (seen.has(key)) continue;

    seen.add(key);
    merged.push({ area, choice, rationale, source: decision.source });
  }

  return merged;
}

// Applies a provider analysis patch while preserving previously clarified context.
export function mergePlanningContext(
  currentContext: AgentPlanningContext,
  analysis: AgentPlanningTurnAnalysis
): AgentPlanningContext {
  const patch = analysis.contextPatch;

  return {
    objective: patch.objective !== undefined ? patch.objective : currentContext.objective,
    summary: patch.summary !== undefined ? patch.summary : currentContext.summary,
    targetOutcome: patch.targetOutcome !== undefined ? patch.targetOutcome : currentContext.targetOutcome,
    inScope: mergeStrings(currentContext.inScope, patch.inScope),
    outOfScope: mergeStrings(currentContext.outOfScope, patch.outOfScope),
    assumptions: mergeStrings(currentContext.assumptions, patch.assumptions),
    constraints: mergeStrings(currentContext.constraints, patch.constraints),
    acceptanceCriteria: mergeStrings(currentContext.acceptanceCriteria, patch.acceptanceCriteria),
    knownRequirements: mergeStrings(currentContext.knownRequirements, analysis.knownRequirements),
    unresolvedUnknowns: dedupeStrings(analysis.unresolvedUnknowns),
    blockingUnknowns: dedupeStrings(analysis.blockingUnknowns),
    affectedAreas: mergeStrings(currentContext.affectedAreas, patch.affectedAreas),
    risks: mergeStrings(currentContext.risks, patch.risks),
    dependencies: mergeStrings(currentContext.dependencies, patch.dependencies),
    technicalDecisions: mergeTechnicalDecisions(currentContext.technicalDecisions, patch.technicalDecisions),
    estimatedComplexity: patch.estimatedComplexity !== undefined ? patch.estimatedComplexity : currentContext.estimatedComplexity,
    planningConfidence: clampConfidence(analysis.confidence || patch.planningConfidence || currentContext.planningConfidence),
  };
}

function hasConcreteDetails(values: string[]) {
  return values.some((value) => value.trim().length >= 16 || value.trim().split(/\s+/).length >= 3);
}

function resolveReadinessBlockerReason({
  objectiveClear,
  scopeBounded,
  hasAcceptanceCriteria,
  blockingUnknowns,
  unresolvedUnknowns,
  confidence,
}: {
  objectiveClear: boolean;
  scopeBounded: boolean;
  hasAcceptanceCriteria: boolean;
  blockingUnknowns: string[];
  unresolvedUnknowns: string[];
  confidence: number;
}): AgentPlanningDecisionReason {
  if (!objectiveClear) return 'missing_objective';
  if (!scopeBounded) return 'scope_unbounded';
  if (!hasAcceptanceCriteria) return 'missing_acceptance_criteria';
  if (blockingUnknowns.length > 0 || unresolvedUnknowns.length > 0) return 'blocking_unknowns';
  return confidence >= AGENT_PLANNING_CONFIDENCE_THRESHOLD ? 'requirements_satisfied' : 'low_confidence';
}

// Evaluates whether the provider's deterministic decision is allowed to complete planning.
export function evaluatePlanningReadiness({
  analysis,
  context,
  answeredQuestionCount,
}: {
  analysis: AgentPlanningTurnAnalysis;
  context: AgentPlanningContext;
  answeredQuestionCount: number;
}): AgentPlanningReadiness {
  const objectiveClear = Boolean(context.objective?.trim());
  const hasScopeSignals =
    context.inScope.length > 0 ||
    context.outOfScope.length > 0 ||
    hasConcreteDetails(context.knownRequirements);
  const hasBoundaryEvidence =
    answeredQuestionCount > 0 ||
    context.outOfScope.length > 0 ||
    hasConcreteDetails(context.constraints) ||
    hasConcreteDetails(context.dependencies) ||
    context.technicalDecisions.some((decision) => decision.source === 'explicit' || decision.source === 'clarified');
  const scopeBounded = hasScopeSignals && hasBoundaryEvidence;
  const hasAcceptanceCriteria = context.acceptanceCriteria.length > 0;
  const blockingUnknowns = dedupeStrings(context.blockingUnknowns);
  const unresolvedUnknowns = dedupeStrings(context.unresolvedUnknowns);
  const confidence = clampConfidence(context.planningConfidence);
  const deterministicReason = resolveReadinessBlockerReason({
    objectiveClear,
    scopeBounded,
    hasAcceptanceCriteria,
    blockingUnknowns,
    unresolvedUnknowns,
    confidence,
  });
  const modelCompleted =
    analysis.decision.action === 'complete_planning' &&
    analysis.decision.reason === 'requirements_satisfied';
  const deterministicChecksPass = deterministicReason === 'requirements_satisfied';
  const canCompletePlanning = modelCompleted && deterministicChecksPass;

  return {
    objectiveClear,
    scopeBounded,
    hasAcceptanceCriteria,
    knownRequirements: dedupeStrings(analysis.knownRequirements),
    unresolvedUnknowns,
    blockingUnknowns,
    confidence,
    recommendedNextAction: canCompletePlanning ? 'complete_planning' : 'ask_questions',
    reasonSummary: [
      objectiveClear ? 'Objective is clear.' : 'Objective is still ambiguous.',
      scopeBounded ? 'Scope is bounded.' : 'Scope is still materially unbounded.',
      hasAcceptanceCriteria ? 'Acceptance criteria are present.' : 'Acceptance criteria are missing.',
      blockingUnknowns.length === 0 ? 'No blocking unknowns remain.' : 'Blocking unknowns remain.',
      unresolvedUnknowns.length === 0 ? 'No unresolved unknowns remain.' : 'Unresolved unknowns remain.',
      modelCompleted ? 'Model requested planning completion.' : `Model requested clarification: ${analysis.decision.reason}.`,
      deterministicChecksPass ? 'Deterministic readiness checks passed.' : `Deterministic blocker: ${deterministicReason}.`,
    ],
  };
}

function normalizeQuestionOptions(options: AgentQuestionOption[]) {
  const seen = new Set<string>();
  const normalizedOptions = options.flatMap((option) => {
    const optionKey = normalizeAgentQuestionKey(option.optionKey || option.label);
    const label = option.label.trim();
    const description = option.description.trim();

    if (!optionKey || optionKey === NONE_OF_THE_ABOVE_OPTION.optionKey || !label || !description || seen.has(optionKey)) {
      return [];
    }

    seen.add(optionKey);
    return [{ optionKey, label, description, isRecommended: option.isRecommended === true }];
  }).slice(0, 3);
  const recommendedKey =
    normalizedOptions.find((option) => option.isRecommended)?.optionKey ??
    normalizedOptions[0]?.optionKey ??
    null;

  return [
    ...normalizedOptions.map((option) => ({ ...option, isRecommended: option.optionKey === recommendedKey })),
    NONE_OF_THE_ABOVE_OPTION,
  ];
}

// Selects the next non-duplicate clarification cards and records discarded candidates for diagnostics.
export function selectClarificationQuestions({
  candidateQuestions,
  existingQuestions,
}: {
  candidateQuestions: AgentQuestion[];
  existingQuestions: AgentQuestion[];
}) {
  const seenExistingKeys = new Set(existingQuestions.map((question) => normalizeAgentQuestionKey(question.questionKey)));
  const seenExistingTexts = new Set(existingQuestions.map((question) => normalizeQuestionText(question.prompt)));
  const seenCandidateKeys = new Set<string>();
  const seenCandidateTexts = new Set<string>();
  const discardedQuestions: Array<{ questionKey: string; prompt: string; reason: string }> = [];
  const selectedQuestions: AgentQuestion[] = [];

  for (const candidateQuestion of candidateQuestions) {
    const questionKey = normalizeAgentQuestionKey(candidateQuestion.questionKey || candidateQuestion.prompt);
    const prompt = candidateQuestion.prompt.trim();
    const normalizedText = normalizeQuestionText(prompt);
    const options = normalizeQuestionOptions(candidateQuestion.options);

    if (options.length !== 4) {
      discardedQuestions.push({ questionKey, prompt, reason: 'Question did not include three unique guided options.' });
      continue;
    }

    if (seenExistingKeys.has(questionKey) || seenCandidateKeys.has(questionKey)) {
      discardedQuestions.push({ questionKey, prompt, reason: 'Question key already exists.' });
      continue;
    }

    if (seenExistingTexts.has(normalizedText) || seenCandidateTexts.has(normalizedText)) {
      discardedQuestions.push({ questionKey, prompt, reason: 'Question text already exists.' });
      continue;
    }

    seenCandidateKeys.add(questionKey);
    seenCandidateTexts.add(normalizedText);
    selectedQuestions.push({
      ...candidateQuestion,
      questionKey,
      prompt,
      whyThisMatters: candidateQuestion.whyThisMatters.trim(),
      options,
    });
  }

  return {
    discardedQuestions,
    selectedQuestions: selectedQuestions
      .sort((left, right) => Number(right.blocking) - Number(left.blocking) || Number(right.required) - Number(left.required))
      .slice(0, MAX_AGENT_QUESTIONS_PER_TURN),
  };
}

function buildQuestion(
  questionKey: string,
  category: AgentQuestionCategory,
  prompt: string,
  whyThisMatters: string,
  options: AgentQuestionOption[]
): AgentQuestion {
  return {
    questionKey,
    category,
    prompt,
    whyThisMatters,
    required: true,
    blocking: true,
    options,
  };
}

// Converts a submitted clarification answer into a durable context sentence.
function buildClarifiedAnswerStatement(
  question: AgentQuestion,
  answer: AgentClarificationAnswer,
  selectedOption: AgentQuestionOption
) {
  const note = answer.note?.trim();
  return [
    `${question.prompt}: ${selectedOption.label}.`,
    selectedOption.description,
    note ? `Note: ${note}` : null,
  ].filter(Boolean).join(' ');
}

// Applies one clarification answer to the relevant structured planning-context fields.
function mergeClarifiedAnswerIntoContext(
  context: AgentPlanningContext,
  question: AgentQuestion,
  answer: AgentClarificationAnswer
): AgentPlanningContext {
  const selectedOption = question.options.find((option) => option.optionKey === answer.selectedOptionKey);
  if (!selectedOption) return context;

  const statement = buildClarifiedAnswerStatement(question, answer, selectedOption);
  const nextContext: AgentPlanningContext = {
    ...context,
    inScope: [...context.inScope],
    outOfScope: [...context.outOfScope],
    assumptions: [...context.assumptions],
    constraints: [...context.constraints],
    acceptanceCriteria: [...context.acceptanceCriteria],
    knownRequirements: mergeStrings(context.knownRequirements, [statement]),
    unresolvedUnknowns: [...context.unresolvedUnknowns],
    blockingUnknowns: [...context.blockingUnknowns],
    affectedAreas: [...context.affectedAreas],
    risks: [...context.risks],
    dependencies: [...context.dependencies],
    technicalDecisions: [...context.technicalDecisions],
  };

  if (question.category === 'scope') {
    nextContext.inScope = mergeStrings(nextContext.inScope, [statement]);
  } else if (question.category === 'acceptance_criteria') {
    nextContext.acceptanceCriteria = mergeStrings(nextContext.acceptanceCriteria, [statement]);
  } else if (question.category === 'constraints' || question.category === 'rollout') {
    nextContext.constraints = mergeStrings(nextContext.constraints, [statement]);
  } else if (question.category === 'dependencies') {
    nextContext.dependencies = mergeStrings(nextContext.dependencies, [statement]);
  } else if (question.category === 'technical') {
    nextContext.technicalDecisions = mergeTechnicalDecisions(nextContext.technicalDecisions, [{
      area: question.prompt,
      choice: selectedOption.label,
      rationale: [selectedOption.description, answer.note?.trim()].filter(Boolean).join(' '),
      source: 'clarified',
    }]);
  } else if (question.category === 'priority' && !nextContext.targetOutcome) {
    nextContext.targetOutcome = statement;
  }

  return nextContext;
}

// Merges submitted clarification answers into structured memory before the next provider turn.
export function applyClarificationAnswersToContext({
  context,
  questions,
  answers,
}: {
  context: AgentPlanningContext;
  questions: AgentQuestion[];
  answers: AgentClarificationAnswer[];
}) {
  const questionsByKey = new Map(questions.map((question) => [normalizeAgentQuestionKey(question.questionKey), question]));

  return answers.reduce((nextContext, answer) => {
    const question = questionsByKey.get(normalizeAgentQuestionKey(answer.questionKey));
    return question ? mergeClarifiedAnswerIntoContext(nextContext, question, answer) : nextContext;
  }, context);
}

// Builds deterministic fallback cards when provider candidates cannot be used.
export function buildFallbackClarificationQuestions(readiness: AgentPlanningReadiness): AgentQuestion[] {
  const questions: AgentQuestion[] = [];

  if (!readiness.objectiveClear) {
    questions.push(buildQuestion('primary-outcome', 'priority', 'Which primary outcome matters most for the first release?', 'The plan needs one dominant outcome so it can prioritize tradeoffs correctly.', [
      { optionKey: 'working-core-workflow', label: 'Working workflow', description: 'Prove the main workflow works end to end first.', isRecommended: true },
      { optionKey: 'operator-visibility', label: 'Operator visibility', description: 'Prioritize dashboards, observability, and decision-making visibility.' },
      { optionKey: 'platform-foundation', label: 'Platform foundation', description: 'Prioritize reusable architecture for future agent capabilities.' },
    ]));
  }

  if (!readiness.scopeBounded) {
    questions.push(buildQuestion('first-release-boundary', 'scope', 'What should the first release boundary be?', 'A tighter first-release boundary keeps the implementation plan realistic and sequenced.', [
      { optionKey: 'focused-mvp', label: 'Focused MVP', description: 'Ship one core workflow with minimum supporting pieces.', isRecommended: true },
      { optionKey: 'balanced-v1', label: 'Balanced V1', description: 'Ship the core workflow plus a few supporting capabilities.' },
      { optionKey: 'broad-platform', label: 'Broad platform', description: 'Build several major capabilities in the first release.' },
    ]));
  }

  if (!readiness.hasAcceptanceCriteria) {
    questions.push(buildQuestion('first-release-success-bar', 'acceptance_criteria', 'What should count as success for the first release?', 'The plan needs a clear success bar before it can choose the right amount of build and polish.', [
      { optionKey: 'end-to-end-demo', label: 'End-to-end demo', description: 'The first release proves the core workflow from input to output.', isRecommended: true },
      { optionKey: 'production-ready-slice', label: 'Production slice', description: 'The first release is stable, observable, and ready for real users.' },
      { optionKey: 'exploratory-prototype', label: 'Prototype', description: 'The first release validates concept and UX before hardening.' },
    ]));
  }

  if (questions.length === 0) {
    questions.push(buildQuestion('planning-direction', 'priority', 'What should this implementation plan optimize for?', 'The planner needs one concrete direction before it can turn the request into phased work.', [
      { optionKey: 'fastest-usable-slice', label: 'Fastest slice', description: 'Optimize for the smallest useful release that can be built quickly.', isRecommended: true },
      { optionKey: 'balanced-foundation', label: 'Balanced foundation', description: 'Balance delivery speed with enough architecture for the next phase.' },
      { optionKey: 'long-term-architecture', label: 'Long-term architecture', description: 'Optimize for the long-term system shape from the start.' },
    ]));
  }

  return questions.slice(0, MAX_AGENT_QUESTIONS_PER_TURN);
}

// Formats selected clarification answers into a durable transcript message.
export function buildClarificationAnswerSummary(questions: AgentQuestion[], answers: AgentClarificationAnswer[]) {
  const answersByQuestionKey = new Map(answers.map((answer) => [normalizeAgentQuestionKey(answer.questionKey), answer]));

  return [
    'Clarification answers submitted:',
    ...questions.map((question, index) => {
      const answer = answersByQuestionKey.get(normalizeAgentQuestionKey(question.questionKey));
      const selectedOption = question.options.find((option) => option.optionKey === answer?.selectedOptionKey);
      const note = answer?.note?.trim();

      return [
        `${index + 1}. ${question.prompt}`,
        `Answer: ${selectedOption?.label ?? 'Unknown option'}`,
        note ? `Note: ${note}` : null,
      ].filter(Boolean).join('\n');
    }),
  ].join('\n\n');
}

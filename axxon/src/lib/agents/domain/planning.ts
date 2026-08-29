// Contains deterministic planning-readiness rules and clarification-question normalization helpers.
import type {
  AgentPlanArtifact,
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
import { extractPlanningAnchors, isPromptSpecificClarificationQuestion } from './quality';

export const AGENT_PLANNING_CONFIDENCE_THRESHOLD = 0.7;
export const MAX_AGENT_QUESTIONS_PER_TURN = 3;
const RESOLVABLE_GENERIC_REASONS: AgentPlanningDecisionReason[] = [
  'scope_unbounded',
  'missing_acceptance_criteria',
  'low_confidence',
];

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

// Determines whether the prompt has enough domain detail to safely apply MVP defaults.
function hasConcretePromptSignals(prompt: string | undefined, context: AgentPlanningContext) {
  const promptText = prompt?.trim() ?? '';
  const anchors = extractFallbackPlanningAnchors(prompt, context);
  return Boolean(context.objective?.trim()) && (anchors.length >= 2 || promptText.split(/\s+/).length >= 5);
}

// Builds an immediate, compact planning-run title before any provider response exists.
export function buildPlanningRunTitle(prompt: string) {
  const normalizedPrompt = prompt.replace(/\s+/g, ' ').trim();
  const cleanedPrompt = normalizedPrompt
    .replace(/^(please\s+)?(can|could|would)\s+(we|you)\s+/i, '')
    .replace(/^(please\s+)?(i\s+want\s+to|i\s+need\s+to|we\s+need\s+to|let'?s)\s+/i, '')
    .replace(/^(please\s+)?(build|create|make|implement|add|design|draft|plan|finalize|improve|update)\s+/i, '');
  const fillerWords = new Set([
    'a',
    'all',
    'an',
    'and',
    'for',
    'my',
    'of',
    'our',
    'the',
    'that',
    'to',
    'with',
  ]);
  const words = cleanedPrompt
    .split(/\s+/)
    .map((word) => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
    .filter(Boolean);
  const meaningfulWords = words.filter((word) => !fillerWords.has(word.toLowerCase()));
  const selectedWords = (meaningfulWords.length >= 2 ? meaningfulWords : words).slice(0, 7);
  const titleBase = selectedWords.length > 0 ? selectedWords.join(' ') : normalizedPrompt.slice(0, 80);
  const title = titleCase(titleBase);

  return title.length > 120 ? title.slice(0, 120).trim() : title;
}

// Adds safe first-pass defaults so generic MVP gaps do not force clarification cards.
export function applyPromptPlanningDefaults({
  context,
  prompt,
}: {
  context: AgentPlanningContext;
  prompt?: string;
}): AgentPlanningContext {
  if (!hasConcretePromptSignals(prompt, context)) return context;

  const anchors = extractFallbackPlanningAnchors(prompt, context);
  if (anchors.length < 2) return context;

  const subject = formatAnchorLabel(anchors);
  const titleSubject = titleCase(subject);

  return {
    ...context,
    targetOutcome: context.targetOutcome ?? `Deliver the smallest usable ${subject} workflow described by the prompt.`,
    inScope: context.inScope.length > 0
      ? context.inScope
      : [`${titleSubject} workflow described by the initial prompt.`],
    outOfScope: mergeStrings(context.outOfScope, [
      `Adjacent ${subject} capabilities not named in the prompt are out of scope for the first plan.`,
    ]),
    assumptions: mergeStrings(context.assumptions, [
      `Use a focused MVP boundary for ${subject} unless the prompt or later user messages specify a broader release.`,
      `Use representative ${subject} data for planning unless a live integration is explicitly required.`,
    ]),
    acceptanceCriteria: context.acceptanceCriteria.length > 0
      ? context.acceptanceCriteria
      : [`A representative ${subject} scenario can be completed or reviewed through the prompt-specific workflow.`],
    knownRequirements: mergeStrings(context.knownRequirements, [
      `Plan the prompt-named ${subject} workflow using the concrete terms from the initial request.`,
    ]),
  };
}

// Detects generic MVP cards that should be assumed instead of shown to the user.
function isGenericMvpClarificationQuestion(question: AgentQuestion) {
  const questionText = normalizeQuestionText(question.prompt);
  const optionText = normalizeQuestionText(question.options.map((option) => `${option.label} ${option.description}`).join(' '));

  return (
    /first release boundary|workflow should define the first release|what should count as success|what should prove .* plan is successful/.test(questionText) ||
    /core data flow|operator review|sample records pass|auditable output|focused mvp|balanced v1|broad platform|end-to-end demo|production-ready slice|exploratory prototype/.test(optionText)
  );
}

// Determines whether provider questions contain a concrete unresolved implementation decision.
function hasMaterialProviderQuestion(analysis: AgentPlanningTurnAnalysis, context: AgentPlanningContext, prompt: string | undefined) {
  const anchors = extractPlanningAnchors({ prompt: prompt ?? '', context });

  return analysis.candidateQuestions.some((question) =>
    !isGenericMvpClarificationQuestion(question) &&
    isPromptSpecificClarificationQuestion({ question, anchors })
  );
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
  prompt,
}: {
  analysis: AgentPlanningTurnAnalysis;
  context: AgentPlanningContext;
  answeredQuestionCount: number;
  prompt?: string;
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
  const genericClarificationResolvedByDefaults =
    analysis.decision.action === 'ask_questions' &&
    RESOLVABLE_GENERIC_REASONS.includes(analysis.decision.reason) &&
    !hasMaterialProviderQuestion(analysis, context, prompt);
  const canCompletePlanning = deterministicChecksPass && (modelCompleted || genericClarificationResolvedByDefaults);

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
      genericClarificationResolvedByDefaults ? 'Generic clarification request was satisfied by prompt-derived planning defaults.' : '',
      deterministicChecksPass ? 'Deterministic readiness checks passed.' : `Deterministic blocker: ${deterministicReason}.`,
    ].filter(Boolean),
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
  planningContext,
  prompt,
}: {
  candidateQuestions: AgentQuestion[];
  existingQuestions: AgentQuestion[];
  planningContext?: AgentPlanningContext | null;
  prompt?: string;
}) {
  const anchors = extractPlanningAnchors({ prompt: prompt ?? '', context: planningContext });
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

    if (isGenericMvpClarificationQuestion(candidateQuestion)) {
      discardedQuestions.push({ questionKey, prompt, reason: 'Question asks for generic MVP scope or success-bar input.' });
      continue;
    }

    if (!isPromptSpecificClarificationQuestion({ question: candidateQuestion, anchors })) {
      discardedQuestions.push({ questionKey, prompt, reason: 'Question does not reference the current planning prompt.' });
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

// Shortens a prompt or context value for use inside fallback question text.
function summarizeFallbackSubject(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 90);
}

// Converts a short phrase into title case for generated plan section labels.
function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

// Converts arbitrary prompt terms into stable lower-kebab-case identifiers.
function slugifyPlanId(value: string) {
  const slug = normalizeAgentQuestionKey(value).slice(0, 52);
  return slug || 'planning-workflow';
}

// Trims generated artifact text to the public schema limits without leaving dangling whitespace.
function limitPlanText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}

// Normalizes context strings before copying them into a generated artifact field.
function limitPlanStrings(values: string[], maxLength: number, maxItems: number) {
  const seen = new Set<string>();
  const limitedValues: string[] = [];

  for (const value of values) {
    const limitedValue = limitPlanText(value, maxLength);
    if (!limitedValue) continue;

    const key = limitedValue.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    limitedValues.push(limitedValue);
    if (limitedValues.length >= maxItems) break;
  }

  return limitedValues;
}

// Picks domain terms that read naturally in generated questions and fallback plans.
function selectDomainAnchors(anchors: string[]) {
  const phraseAnchors = anchors.filter((anchor) => anchor.includes(' '));
  const singleAnchors = anchors
    .filter((anchor) => !anchor.includes(' '))
    .sort((left, right) => getDomainAnchorPriority(right) - getDomainAnchorPriority(left));
  const selected: string[] = [];
  const addAnchor = (anchor: string) => {
    if (selected.some((existing) => existing.includes(anchor) || anchor.includes(existing))) return;
    selected.push(anchor);
  };

  const preferredPhrase =
    phraseAnchors.find((anchor) => /ledger|reconciliation|transaction|account|invoice|order|repo|board|agent/.test(anchor)) ??
    phraseAnchors.find((anchor) => /payment/.test(anchor)) ??
    phraseAnchors[0];
  if (preferredPhrase) addAnchor(preferredPhrase);

  for (const anchor of singleAnchors) {
    addAnchor(anchor);
    if (selected.length >= (preferredPhrase ? 2 : 3)) break;
  }

  if (selected.length < 2) {
    for (const anchor of phraseAnchors) {
      addAnchor(anchor);
      if (selected.length >= 2) break;
    }
  }

  return selected.slice(0, 3);
}

// Scores common workflow nouns above broad industry descriptors for fallback labels.
function getDomainAnchorPriority(anchor: string) {
  if (/ledger|reconciliation|payment|transaction|invoice|account/.test(anchor)) return 2;
  if (/fintech|dashboard|platform|workflow/.test(anchor)) return 1;
  return 0;
}

// Builds a human-readable anchor phrase for contextual fallback cards.
function formatAnchorLabel(anchors: string[]) {
  const selectedAnchors = selectDomainAnchors(anchors);
  if (selectedAnchors.length <= 1) return selectedAnchors[0] ?? 'requested';
  return `${selectedAnchors.slice(0, -1).join(', ')} and ${selectedAnchors.at(-1)}`;
}

// Prefers user-prompt domain terms over provider-generated unknown labels for fallback wording.
function extractFallbackPlanningAnchors(prompt: string | undefined, context: AgentPlanningContext | null | undefined) {
  const promptAnchors = extractPlanningAnchors({ prompt: prompt ?? '', context: null });
  return promptAnchors.length >= 2 ? promptAnchors : extractPlanningAnchors({ prompt: prompt ?? '', context });
}

// Collects concrete context statements for use in deterministic fallback plans.
function collectFallbackRequirements(context: AgentPlanningContext) {
  return [
    ...context.knownRequirements,
    ...context.acceptanceCriteria,
    ...context.constraints,
  ];
}

// Builds a deterministic, prompt-anchored plan when provider attempts remain generic.
export function buildFallbackPlanArtifact({
  prompt,
  context,
}: {
  prompt: string;
  context: AgentPlanningContext;
}): AgentPlanArtifact | null {
  const anchors = extractFallbackPlanningAnchors(prompt, context);
  if (anchors.length < 2) return null;

  const subject = formatAnchorLabel(anchors);
  const titleSubject = titleCase(subject);
  const slug = slugifyPlanId(subject);
  const objective = context.objective?.trim() || prompt.trim();
  const requirements = limitPlanStrings(collectFallbackRequirements(context), 240, 30);

  return {
    summary: `Implement ${subject} as a focused first-release workflow using the clarified planning context.`,
    objective: limitPlanText(objective, 1200),
    scope: {
      inScope: context.inScope.length > 0 ? limitPlanStrings(context.inScope, 240, 25) : [`${titleSubject} first-release workflow`],
      outOfScope: limitPlanStrings(context.outOfScope, 240, 25),
    },
    requirements: requirements.length > 0
      ? requirements.slice(0, 30)
      : [`Support ${subject} records, review states, and exception handling from the user request.`],
    assumptions: limitPlanStrings(context.assumptions, 240, 25).length > 0
      ? limitPlanStrings(context.assumptions, 240, 25)
      : [`Unspecified ${subject} data fields will be confirmed before implementation maps sample records.`],
    constraints: limitPlanStrings(context.constraints, 240, 25),
    affectedAreas: limitPlanStrings(context.affectedAreas, 120, 25).length > 0 ? limitPlanStrings(context.affectedAreas, 120, 25) : [limitPlanText(subject, 120)],
    technicalDecisions: context.technicalDecisions.length > 0
      ? context.technicalDecisions.slice(0, 15).map((decision) => ({
          area: limitPlanText(decision.area, 120),
          choice: limitPlanText(decision.choice, 240),
          rationale: limitPlanText(decision.rationale, 320),
          source: decision.source,
        }))
      : [{
          area: `${titleSubject} workflow boundary`,
          choice: 'Use the clarified first-release boundary as the plan source of truth.',
          rationale: `The generated plan must stay anchored to ${subject} rather than a generic delivery template.`,
          source: 'assumed',
        }],
    implementationPhases: [{
      id: `${slug}-data-foundation`,
      title: `${titleSubject} data foundation`,
      summary: `Define the ${subject} records, statuses, and validation rules needed for the first release.`,
      tasks: [{
        id: `${slug}-record-model`,
        title: `${titleSubject} record model`,
        description: `Define the minimum ${subject} record shape, matching status, exception status, and audit fields needed by the first workflow.`,
        type: 'implementation',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: [
          `Representative ${subject} sample records can be classified as matched, unmatched, or exception cases.`,
          `Each ${subject} record preserves enough source detail for review and troubleshooting.`,
        ],
      }],
    }, {
      id: `${slug}-operator-review`,
      title: `${titleSubject} operator review`,
      summary: `Build the user-facing review path for inspecting ${subject} exceptions and outcomes.`,
      tasks: [{
        id: `${slug}-review-surface`,
        title: `${titleSubject} review surface`,
        description: `Show ${subject} totals, mismatch rows, exception reasons, and resolution status in the first-release dashboard flow.`,
        type: 'implementation',
        priority: 'high',
        dependencyIds: [`${slug}-record-model`],
        acceptanceCriteria: [
          `Operators can identify unresolved ${subject} exceptions from sample records.`,
          `Operators can see the status and source details for each ${subject} mismatch.`,
        ],
      }],
    }, {
      id: `${slug}-sample-verification`,
      title: `${titleSubject} sample-record verification`,
      summary: `Prove the first release with representative ${subject} data before expanding scope.`,
      tasks: [{
        id: `${slug}-sample-scenarios`,
        title: `${titleSubject} sample scenarios`,
        description: `Create sample ${subject} scenarios for matched records, missing records, variance records, and reviewed exceptions.`,
        type: 'verification',
        priority: 'medium',
        dependencyIds: [`${slug}-review-surface`],
        acceptanceCriteria: [
          `Sample ${subject} records demonstrate the success criteria captured during clarification.`,
          `The plan leaves unresolved ${subject} production-field questions explicit instead of inventing them.`,
        ],
      }],
    }],
    risks: limitPlanStrings(context.risks, 240, 25).length > 0
      ? limitPlanStrings(context.risks, 240, 25)
      : [`Real ${subject} source data may contain fields or edge cases not represented in first-release samples.`],
    successCriteria: limitPlanStrings(context.acceptanceCriteria, 240, 25).length > 0
      ? limitPlanStrings(context.acceptanceCriteria, 240, 25)
      : [`A user can review representative ${subject} records and explain each exception outcome.`],
    openQuestions: limitPlanStrings([...context.blockingUnknowns, ...context.unresolvedUnknowns], 240, 20),
    notes: ['This fallback plan was generated from persisted planning context after provider outputs remained too generic.'],
  };
}

// Builds prompt-anchored fallback cards when the provider cannot supply usable questions.
function buildContextualFallbackClarificationQuestions(
  readiness: AgentPlanningReadiness,
  context: AgentPlanningContext | null | undefined,
  prompt: string | undefined
) {
  const anchors = extractFallbackPlanningAnchors(prompt, context);
  if (anchors.length < 2) return [];

  const anchorLabel = formatAnchorLabel(anchors);
  const subject = summarizeFallbackSubject(context?.objective ?? prompt ?? `the ${anchorLabel} workflow`);
  const questions: AgentQuestion[] = [];

  if (!readiness.scopeBounded) {
    questions.push(buildQuestion(
      'prompt-specific-implementation-anchor',
      'scope',
      `Which ${anchorLabel} detail should anchor the first implementation pass?`,
      `The plan can assume a focused MVP, but it still needs the most important ${subject} detail for concrete tasks.`,
      [
        { optionKey: 'source-records', label: 'Source records', description: `Define the ${anchorLabel} records, fields, and statuses first.`, isRecommended: true },
        { optionKey: 'user-actions', label: 'User actions', description: `Prioritize the user decisions and state changes around ${anchorLabel}.` },
        { optionKey: 'system-output', label: 'System output', description: `Prioritize the reports, events, or artifacts produced from ${anchorLabel}.` },
      ]
    ));
  }

  if (!readiness.hasAcceptanceCriteria) {
    questions.push(buildQuestion(
      'prompt-specific-output-detail',
      'acceptance_criteria',
      `Which ${anchorLabel} output needs the clearest implementation detail?`,
      `The plan can assume representative ${subject} verification, but it needs the output shape that matters most.`,
      [
        { optionKey: 'exception-states', label: 'Exception states', description: `Make unresolved, reviewed, and resolved ${anchorLabel} states explicit.`, isRecommended: true },
        { optionKey: 'audit-trail', label: 'Audit trail', description: `Show who changed ${anchorLabel} records and why.` },
        { optionKey: 'summary-metrics', label: 'Summary metrics', description: `Expose totals, counts, and variance indicators for ${anchorLabel}.` },
      ]
    ));
  }

  if (questions.length === 0 && readiness.blockingUnknowns.length > 0) {
    questions.push(buildQuestion(
      'prompt-specific-blocker',
      'constraints',
      `Which missing ${anchorLabel} detail should the plan assume?`,
      `The current blocker is ${readiness.blockingUnknowns[0]}, and the plan needs a concrete default to proceed.`,
      [
        { optionKey: 'use-current-system-defaults', label: 'Use current defaults', description: `Assume existing product patterns for ${anchorLabel}.`, isRecommended: true },
        { optionKey: 'keep-open-question', label: 'Keep open question', description: `Keep the ${anchorLabel} detail explicit as an open question.` },
        { optionKey: 'defer-to-first-task', label: 'Defer to discovery', description: `Make discovery of this ${anchorLabel} detail the first implementation task.` },
      ]
    ));
  }

  return questions.slice(0, MAX_AGENT_QUESTIONS_PER_TURN);
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
export function buildFallbackClarificationQuestions(
  readiness: AgentPlanningReadiness,
  context?: AgentPlanningContext | null,
  prompt?: string
): AgentQuestion[] {
  const contextualQuestions = buildContextualFallbackClarificationQuestions(readiness, context, prompt);
  if (contextualQuestions.length > 0) return contextualQuestions;

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

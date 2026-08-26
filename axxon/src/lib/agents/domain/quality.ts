// Evaluates planning prompts, clarification cards, and generated artifacts for prompt-specific quality.
import type {
  AgentPlanArtifact,
  AgentPlanningContext,
  AgentPlanningQuality,
  AgentPlanningQualityIssue,
  AgentQuestion,
} from './contracts';

const QUALITY_PASSING_SCORE = 70;
const MIN_PROMPT_ANCHOR_COVERAGE = 2;

const STOP_WORDS = new Set([
  'about',
  'above',
  'agent',
  'agents',
  'all',
  'also',
  'and',
  'app',
  'application',
  'are',
  'ask',
  'based',
  'build',
  'can',
  'core',
  'create',
  'current',
  'dashboard',
  'define',
  'develop',
  'does',
  'each',
  'ensure',
  'feature',
  'first',
  'flow',
  'for',
  'from',
  'given',
  'have',
  'implementation',
  'include',
  'into',
  'make',
  'more',
  'must',
  'need',
  'needs',
  'plan',
  'planning',
  'prompt',
  'release',
  'scope',
  'should',
  'specific',
  'system',
  'that',
  'the',
  'this',
  'through',
  'track',
  'tracks',
  'use',
  'user',
  'using',
  'when',
  'with',
  'workflow',
]);

const GENERIC_PLAN_PATTERNS = [
  'planning phase',
  'define project scope',
  'define objectives and goals',
  'create project plan',
  'assign resources',
  'design phase',
  'create ux designs',
  'technical architecture is reviewed and approved',
  'development phase',
  'develop frontend',
  'develop backend',
  'integrate services',
  'testing phase',
  'unit testing',
  'integration testing',
  'end-to-end testing',
  'demo phase',
  'prepare demo materials',
  'conduct demo',
  'address feedback',
  'launch phase',
  'deploy dashboard',
  'configure monitoring',
  'notify stakeholders',
  'reviewed and approved by stakeholders',
  'resources are allocated',
];

const GENERIC_ACCEPTANCE_PATTERNS = [
  'clearly defined',
  'reviewed and approved',
  'developed and tested',
  'passes integration tests',
  'passes end-to-end tests',
  'successfully deployed',
  'stakeholders provide feedback',
  'configured and operational',
];

const COMMON_ASSUMED_STACK_TERMS = [
  'react.js',
  'react',
  'node.js',
  'node',
  'express',
  'postgresql',
  'postgres',
  'mongodb',
  'mysql',
];

// Normalizes free-form text for matching planner anchors and generic-template phrases.
function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Converts simple plural anchor forms into a stable singular match key.
function normalizeAnchor(value: string) {
  const normalized = normalizeText(value);
  if (normalized.endsWith('ies') && normalized.length > 5) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith('s') && normalized.length > 4) return normalized.slice(0, -1);
  return normalized;
}

// Collects all meaningful context strings that should influence plan quality.
function collectPlanningContextText(context?: AgentPlanningContext | null) {
  if (!context) return [];

  return [
    context.objective,
    context.summary,
    context.targetOutcome,
    ...context.inScope,
    ...context.outOfScope,
    ...context.assumptions,
    ...context.constraints,
    ...context.acceptanceCriteria,
    ...context.knownRequirements,
    ...context.unresolvedUnknowns,
    ...context.blockingUnknowns,
    ...context.affectedAreas,
    ...context.risks,
    ...context.dependencies,
    ...context.technicalDecisions.flatMap((decision) => [decision.area, decision.choice, decision.rationale]),
  ].filter((value): value is string => Boolean(value?.trim()));
}

// Extracts prompt-specific nouns and short phrases that generated questions and plans should reuse.
export function extractPlanningAnchors({
  prompt,
  context,
}: {
  prompt: string;
  context?: AgentPlanningContext | null;
}) {
  const sourceText = normalizeText([prompt, ...collectPlanningContextText(context)].join(' '));
  const tokens = sourceText
    .split(' ')
    .map(normalizeAnchor)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
  const tokenCounts = new Map<string, number>();

  for (const token of tokens) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }

  const bigrams: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const first = tokens[index];
    const second = tokens[index + 1];
    if (!first || !second || first === second) continue;
    bigrams.push(`${first} ${second}`);
  }

  const anchors = [
    ...bigrams.filter((bigram, index) => bigrams.indexOf(bigram) === index).slice(0, 4),
    ...[...tokenCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([token]) => token)
      .slice(0, 10),
  ];

  return anchors.filter((anchor, index) => anchors.indexOf(anchor) === index);
}

// Checks whether a normalized text block contains a prompt anchor or its simple singular form.
function containsAnchor(text: string, anchor: string) {
  const normalizedText = normalizeText(text);
  const normalizedAnchor = normalizeAnchor(anchor);
  if (!normalizedAnchor) return false;

  return normalizedText.includes(normalizedAnchor);
}

// Counts prompt anchors that are represented in a generated text block.
function countCoveredAnchors(text: string, anchors: string[]) {
  return anchors.filter((anchor) => containsAnchor(text, anchor)).length;
}

// Flattens a generated plan into searchable strings for quality evaluation.
function collectArtifactText(artifact: AgentPlanArtifact) {
  return [
    artifact.summary,
    artifact.objective,
    ...artifact.scope.inScope,
    ...artifact.scope.outOfScope,
    ...artifact.requirements,
    ...artifact.assumptions,
    ...artifact.constraints,
    ...artifact.affectedAreas,
    ...artifact.technicalDecisions.flatMap((decision) => [decision.area, decision.choice, decision.rationale]),
    ...artifact.implementationPhases.flatMap((phase) => [
      phase.title,
      phase.summary,
      ...phase.tasks.flatMap((task) => [task.title, task.description, task.type, ...task.acceptanceCriteria]),
    ]),
    ...artifact.risks,
    ...artifact.successCriteria,
    ...artifact.openQuestions,
    ...artifact.notes,
  ].join(' ');
}

// Adds a bounded quality issue to the current diagnostic list.
function pushIssue(
  issues: AgentPlanningQualityIssue[],
  issue: AgentPlanningQualityIssue
) {
  if (issues.some((existingIssue) => existingIssue.code === issue.code)) return;
  issues.push({ ...issue, evidence: issue.evidence.slice(0, 8) });
}

// Finds generic project-management template fragments in plan text.
function findGenericTemplateHits(values: string[]) {
  const hits: string[] = [];

  for (const value of values) {
    const normalizedValue = normalizeText(value);
    const matchedPattern = GENERIC_PLAN_PATTERNS.find((pattern) => normalizedValue.includes(pattern));
    if (matchedPattern) hits.push(value.trim());
  }

  return hits.filter(Boolean);
}

// Determines whether a generated plan overuses generic acceptance criteria.
function findGenericAcceptanceHits(artifact: AgentPlanArtifact) {
  const acceptanceValues = [
    ...artifact.successCriteria,
    ...artifact.implementationPhases.flatMap((phase) => phase.tasks.flatMap((task) => task.acceptanceCriteria)),
  ];

  return acceptanceValues.filter((value) => {
    const normalizedValue = normalizeText(value);
    return GENERIC_ACCEPTANCE_PATTERNS.some((pattern) => normalizedValue.includes(pattern));
  });
}

// Finds stack choices that were introduced without prompt/context support.
function findUnsupportedStackAssumptions({
  artifactText,
  sourceText,
}: {
  artifactText: string;
  sourceText: string;
}) {
  const normalizedSource = normalizeText(sourceText);
  const normalizedArtifact = normalizeText(artifactText);

  return COMMON_ASSUMED_STACK_TERMS.filter((term) =>
    normalizedArtifact.includes(term) && !normalizedSource.includes(term)
  );
}

// Computes the share of implementation tasks that reference prompt-specific anchors.
function calculateAnchoredTaskRatio(artifact: AgentPlanArtifact, anchors: string[]) {
  const tasks = artifact.implementationPhases.flatMap((phase) => phase.tasks);
  if (tasks.length === 0 || anchors.length === 0) return 1;

  const anchoredTasks = tasks.filter((task) =>
    countCoveredAnchors([task.title, task.description, ...task.acceptanceCriteria].join(' '), anchors) > 0
  );

  return anchoredTasks.length / tasks.length;
}

// Evaluates whether a clarification card is specific enough for the current prompt.
export function isPromptSpecificClarificationQuestion({
  question,
  anchors,
}: {
  question: AgentQuestion;
  anchors: string[];
}) {
  if (anchors.length < 2) return true;

  const searchableText = [
    question.prompt,
    question.whyThisMatters,
    ...question.options.flatMap((option) => [option.label, option.description]),
  ].join(' ');

  return countCoveredAnchors(searchableText, anchors) > 0;
}

// Evaluates a generated plan artifact before it can be shown for review.
export function evaluatePlanArtifactQuality({
  artifact,
  context,
  prompt,
}: {
  artifact: AgentPlanArtifact;
  context?: AgentPlanningContext | null;
  prompt: string;
}): AgentPlanningQuality {
  const anchors = extractPlanningAnchors({ prompt, context });
  const artifactText = collectArtifactText(artifact);
  const sourceText = [prompt, ...collectPlanningContextText(context)].join(' ');
  const issues: AgentPlanningQualityIssue[] = [];
  let score = 100;

  const anchorCoverage = countCoveredAnchors(artifactText, anchors);
  if (anchors.length >= 3 && anchorCoverage < MIN_PROMPT_ANCHOR_COVERAGE) {
    score -= 30;
    pushIssue(issues, {
      code: 'low_prompt_anchor_coverage',
      severity: 'error',
      message: 'The plan does not reuse enough concrete terms from the planning prompt.',
      evidence: anchors.slice(0, 6),
    });
  }

  const phaseAndTaskValues = artifact.implementationPhases.flatMap((phase) => [
    phase.title,
    phase.summary,
    ...phase.tasks.flatMap((task) => [task.title, task.description, ...task.acceptanceCriteria]),
  ]);
  const genericTemplateHits = findGenericTemplateHits(phaseAndTaskValues);
  if (genericTemplateHits.length >= 2) {
    score -= 35;
    pushIssue(issues, {
      code: 'generic_project_template',
      severity: 'error',
      message: 'The implementation plan resembles a generic project-management template.',
      evidence: genericTemplateHits,
    });
  }

  const genericAcceptanceHits = findGenericAcceptanceHits(artifact);
  if (genericAcceptanceHits.length >= 2) {
    score -= 20;
    pushIssue(issues, {
      code: 'generic_acceptance_criteria',
      severity: 'error',
      message: 'Acceptance criteria are too generic to verify the requested outcome.',
      evidence: genericAcceptanceHits,
    });
  }

  const anchoredTaskRatio = calculateAnchoredTaskRatio(artifact, anchors);
  if (anchors.length >= 3 && artifact.implementationPhases.length > 0 && anchoredTaskRatio < 0.4) {
    score -= 20;
    pushIssue(issues, {
      code: 'low_task_specificity',
      severity: 'error',
      message: 'Too few implementation tasks are tied to the prompt-specific workflow.',
      evidence: [`${Math.round(anchoredTaskRatio * 100)}% of tasks reference prompt anchors.`],
    });
  }

  const unsupportedStackTerms = findUnsupportedStackAssumptions({ artifactText, sourceText });
  if (unsupportedStackTerms.length > 0) {
    score -= 10;
    pushIssue(issues, {
      code: 'unsupported_stack_assumption',
      severity: 'warning',
      message: 'The plan introduces stack choices that were not established by the prompt or context.',
      evidence: unsupportedStackTerms,
    });
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const passed = boundedScore >= QUALITY_PASSING_SCORE && !issues.some((issue) => issue.severity === 'error');

  return {
    score: boundedScore,
    passed,
    issues,
  };
}

// Produces compact feedback for a second model attempt after quality rejection.
export function buildPlanQualityFeedback(quality: AgentPlanningQuality) {
  return [
    `The previous plan failed quality review with score ${quality.score}.`,
    'Regenerate the plan so every phase and task is specific to the prompt and planning context.',
    'Do not use generic Planning, Design, Development, Testing, Demo, or Launch phase templates unless the user explicitly requested those phases.',
    'Do not introduce unprovided stack choices as facts; put uncertain choices in assumptions or openQuestions.',
    ...quality.issues.map((issue) => `${issue.code}: ${issue.message} Evidence: ${issue.evidence.join('; ')}`),
  ].join('\n');
}

// Attaches server-computed quality metadata to a generated plan artifact.
export function attachPlanArtifactQuality({
  artifact,
  context,
  prompt,
}: {
  artifact: AgentPlanArtifact;
  context?: AgentPlanningContext | null;
  prompt: string;
}): AgentPlanArtifact {
  return {
    ...artifact,
    quality: evaluatePlanArtifactQuality({ artifact, context, prompt }),
  };
}

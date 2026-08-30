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
  'all',
  'also',
  'and',
  'app',
  'application',
  'are',
  'ask',
  'alongside',
  'based',
  'build',
  'built',
  'can',
  'core',
  'create',
  'current',
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
  'functionality',
  'given',
  'have',
  'implementation',
  'include',
  'into',
  'make',
  'many',
  'more',
  'must',
  'need',
  'needs',
  'other',
  'plan',
  'planning',
  'prompt',
  'release',
  'scope',
  'should',
  'showing',
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
  'want',
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
  'deploy application',
  'configure monitoring',
  'install rust',
  'set up next js project',
  'setup next js project',
  'set up nextjs project',
  'setup nextjs project',
  'build dashboard layout',
  'create dashboard layout',
  'implement real time data stream',
  'create visualization components',
  'test frontend and backend integration',
  'monitor application performance',
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
  'chart.js',
  'chartjs',
];

const MONITORING_SLOT_PATTERNS = [{
  code: 'missing_data_exporter',
  label: 'data exporter',
  promptPatterns: [/monitor/, /telemetry/, /performance/, /eval/, /tool call/],
  artifactPatterns: [/export/, /collector/, /gateway/, /opentelemetry/, /\botel\b/, /prometheus/, /api/, /event log/, /source record/],
}, {
  code: 'missing_realtime_strategy',
  label: 'realtime strategy',
  promptPatterns: [/real[\s-]?time/, /stream/, /live/],
  artifactPatterns: [/websocket/, /\bsse\b/, /server-sent/, /poll/, /stream/, /pubsub/, /redis/, /event bus/],
}, {
  code: 'missing_visualization_tooling',
  label: 'visualization tooling',
  promptPatterns: [/graph/, /chart/, /visual/, /analytics/],
  artifactPatterns: [/recharts/, /chart\.?js/, /\bd3\b/, /visx/, /echarts/, /canvas/, /webgl/, /visualization/],
}, {
  code: 'missing_storage_backend',
  label: 'storage backend',
  promptPatterns: [/monitor/, /telemetry/, /performance/, /metric/],
  artifactPatterns: [/event store/, /rollup table/, /metrics backend/, /trace store/, /telemetry store/, /prometheus/, /influxdb/, /timescaledb/, /postgres/, /database/, /warehouse/],
}, {
  code: 'missing_retention_window',
  label: 'retention window',
  promptPatterns: [/monitor/, /telemetry/, /performance/, /metric/],
  artifactPatterns: [/\b\d+\s?(h|hr|hrs|hour|hours|d|day|days|m|mo|month|months|y|yr|year|years)\b/, /24h/, /7d/, /30d/, /90d/, /180d/, /1y/, /retention window/],
}] as const;

const MATERIAL_OPEN_QUESTION_PATTERNS = [
  /exporter/,
  /collector/,
  /realtime/,
  /real time/,
  /websocket/,
  /sse/,
  /graph/,
  /visuali[sz]ation/,
  /chart/,
  /telemetry/,
  /eval/,
  /tool call/,
  /trace/,
  /storage/,
  /database/,
  /backend/,
  /retention/,
  /rollup/,
  /access/,
  /auth/,
  /permission/,
  /acceptance/,
  /success/,
] as const;

const CONDITIONAL_SECURITY_QUESTION_PATTERNS = [
  /compliance/,
  /security regulation/,
  /regulated/,
  /policy/,
  /privacy/,
  /pii/,
] as const;

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
  if (normalized.endsWith('js')) return normalized;
  if (normalized.endsWith('ies') && normalized.length > 5) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith('s') && normalized.length > 4 && !normalized.endsWith('ss')) return normalized.slice(0, -1);
  return normalized;
}

// Scores phrase anchors so domain workflow phrases beat accidental adjacent words.
function getPhraseAnchorPriority(anchor: string) {
  if (/agent performance|tool call|realtime eval|eval tool|monitor performance/.test(anchor)) return 4;
  if (/monitoring dashboard|dashboard|realtime|telemetry|eval|trace|metric/.test(anchor)) return 3;
  if (/rust|nextjs|postgres|redis|opentelemetry/.test(anchor)) return 2;
  return 1;
}

// Scores single-token anchors so named technologies remain visible in planner prompts.
function getTokenAnchorPriority(anchor: string) {
  if (/rust|nextjs|postgres|redis|opentelemetry/.test(anchor)) return 4;
  if (/dashboard|realtime|telemetry|eval|trace|metric|monitor|monitoring|performance/.test(anchor)) return 3;
  if (/tool|call|agent|graph|visual/.test(anchor)) return 2;
  return 1;
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

  const uniqueBigrams = bigrams.filter((bigram, index) => bigrams.indexOf(bigram) === index);
  const anchors = [
    ...uniqueBigrams
      .sort((left, right) => getPhraseAnchorPriority(right) - getPhraseAnchorPriority(left))
      .slice(0, 4),
    ...[...tokenCounts.entries()]
      .sort((left, right) =>
        right[1] - left[1] ||
        getTokenAnchorPriority(right[0]) - getTokenAnchorPriority(left[0]) ||
        left[0].localeCompare(right[0])
      )
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
    ...(artifact.implementationDetails ? [
      ...artifact.implementationDetails.dataFlow,
      ...artifact.implementationDetails.tooling,
      ...artifact.implementationDetails.integrations,
      ...artifact.implementationDetails.realtimeStrategy,
      ...artifact.implementationDetails.storageAndRetention,
      ...artifact.implementationDetails.observability,
      ...artifact.implementationDetails.securityAndAccess,
    ] : []),
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

// Collects final-plan fields that must not contain unresolved implementation alternatives.
function collectArtifactDecisionValues(artifact: AgentPlanArtifact) {
  return [
    ...(artifact.implementationDetails ? [
      ...artifact.implementationDetails.dataFlow,
      ...artifact.implementationDetails.tooling,
      ...artifact.implementationDetails.integrations,
      ...artifact.implementationDetails.realtimeStrategy,
      ...artifact.implementationDetails.storageAndRetention,
      ...artifact.implementationDetails.observability,
      ...artifact.implementationDetails.securityAndAccess,
    ] : []),
    ...artifact.requirements,
    ...artifact.assumptions,
    ...artifact.constraints,
    ...artifact.technicalDecisions.flatMap((decision) => [decision.area, decision.choice, decision.rationale]),
    ...artifact.implementationPhases.flatMap((phase) => [
      phase.title,
      phase.summary,
      ...phase.tasks.flatMap((task) => [task.title, task.description, ...task.acceptanceCriteria]),
    ]),
    ...artifact.successCriteria,
  ].filter((value): value is string => Boolean(value?.trim()));
}

// Extracts technology names that the final plan must explicitly carry forward.
function extractPromptTechnologyTerms(prompt: string) {
  const normalizedPrompt = normalizeText(prompt);
  const technologies: string[] = [];

  if (/\brust\b/.test(normalizedPrompt)) technologies.push('rust');
  if (/next\s?js|nextjs/.test(normalizedPrompt)) technologies.push('nextjs');
  if (/typescript/.test(normalizedPrompt)) technologies.push('typescript');
  if (/postgres|postgresql/.test(normalizedPrompt)) technologies.push('postgresql');
  if (/redis/.test(normalizedPrompt)) technologies.push('redis');
  if (/opentelemetry|\botel\b/.test(normalizedPrompt)) technologies.push('opentelemetry');

  return technologies;
}

// Checks normalized text against a bounded group of quality patterns.
function hasPatternMatch(value: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

// Determines whether security or compliance questions materially affect the requested plan.
function hasSecuritySensitiveSignals({
  artifact,
  context,
  prompt,
}: {
  artifact: AgentPlanArtifact;
  context?: AgentPlanningContext | null;
  prompt: string;
}) {
  const sourceText = normalizeText([
    prompt,
    ...collectPlanningContextText(context),
    artifact.summary,
    artifact.objective,
    ...artifact.requirements,
    ...artifact.constraints,
    ...artifact.successCriteria,
  ].join(' '));

  return hasPatternMatch(sourceText, [
    /production/,
    /customer/,
    /payment/,
    /finance/,
    /ledger/,
    /health/,
    /audit/,
    /auth/,
    /access/,
    /permission/,
    /regulated/,
    /compliance/,
    /pii/,
  ]);
}

// Finds final-plan open questions that should have been resolved before artifact generation.
function findMaterialOpenQuestions({
  artifact,
  context,
  prompt,
}: {
  artifact: AgentPlanArtifact;
  context?: AgentPlanningContext | null;
  prompt: string;
}) {
  const securitySensitive = hasSecuritySensitiveSignals({ artifact, context, prompt });

  return artifact.openQuestions.filter((question) => {
    const normalizedQuestion = normalizeText(question);
    const materialQuestion = hasPatternMatch(normalizedQuestion, MATERIAL_OPEN_QUESTION_PATTERNS);
    const conditionalSecurityQuestion =
      securitySensitive && hasPatternMatch(normalizedQuestion, CONDITIONAL_SECURITY_QUESTION_PATTERNS);

    return materialQuestion || conditionalSecurityQuestion;
  });
}

// Finds plan lines that leave a material implementation choice as "A or B" instead of choosing one path.
function findUndecidedMaterialAlternatives(artifact: AgentPlanArtifact) {
  return collectArtifactDecisionValues(artifact).filter((value) => {
    const normalizedValue = normalizeText(value);
    const hasMaterialTerm = hasPatternMatch(normalizedValue, [
      /prometheus/,
      /influxdb/,
      /timescaledb/,
      /postgres/,
      /database/,
      /storage/,
      /event store/,
      /metrics backend/,
      /collector/,
      /gateway/,
      /websocket/,
      /server sent/,
      /sse/,
      /polling/,
      /recharts/,
      /chart/,
      /\bd3\b/,
      /visx/,
      /canvas/,
      /webgl/,
    ]);
    const hasAlternative = /\b(or|versus|vs)\b/.test(normalizedValue) || /\beither\b/.test(normalizedValue);

    return hasMaterialTerm && hasAlternative;
  });
}

// Finds monitoring data flow that connects the dashboard directly to an OTEL collector path.
function findInvalidMonitoringDataFlow(artifact: AgentPlanArtifact) {
  return collectArtifactDecisionValues(artifact).filter((value) => {
    const normalizedValue = normalizeText(value);
    const mentionsCollector = /opentelemetry collector|otel collector|collector/.test(normalizedValue);
    const mentionsDashboard = /next js|nextjs|frontend|dashboard|client/.test(normalizedValue);
    const connectsDashboard = /subscrib|connect|receive|stream|proxy|read/.test(normalizedValue);
    const directCollectorBridge =
      /subscrib.*collector|collector.*subscrib|proxy.*collector|collector.*proxy|stream.*collector|collector.*stream/.test(normalizedValue);

    return mentionsCollector && mentionsDashboard && connectsDashboard && directCollectorBridge;
  });
}

// Finds realtime monitoring detail groups that are absent from the generated plan.
function findMissingMonitoringSlots({ prompt, artifactText }: { prompt: string; artifactText: string }) {
  const normalizedPrompt = normalizeText(prompt);
  const normalizedArtifactText = normalizeText(artifactText);

  return MONITORING_SLOT_PATTERNS.filter((slot) =>
    hasPatternMatch(normalizedPrompt, slot.promptPatterns) &&
    !hasPatternMatch(normalizedArtifactText, slot.artifactPatterns)
  );
}

// Counts concrete telemetry record families named in the generated plan.
function countTelemetrySignals(artifactText: string) {
  const normalizedArtifactText = normalizeText(artifactText);

  return ['eval', 'tool call', 'trace', 'latency', 'failure', 'cost', 'queue', 'token', 'run state']
    .filter((signal) => normalizedArtifactText.includes(signal)).length;
}

// Handles common spelling variants when checking named technology coverage.
function artifactCoversTechnology(normalizedArtifactText: string, technology: string) {
  if (technology === 'nextjs') return /next\s?js|nextjs/.test(normalizedArtifactText);
  if (technology === 'opentelemetry') return /opentelemetry|\botel\b/.test(normalizedArtifactText);
  return normalizedArtifactText.includes(technology);
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

  return COMMON_ASSUMED_STACK_TERMS.filter((term) => {
    const normalizedTerm = normalizeText(term);
    return normalizedArtifact.includes(normalizedTerm) && !normalizedSource.includes(normalizedTerm);
  });
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
  const normalizedArtifactText = normalizeText(artifactText);
  const normalizedPromptText = normalizeText(prompt);
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

  const missingTechnologies = extractPromptTechnologyTerms(prompt)
    .filter((technology) => !artifactCoversTechnology(normalizedArtifactText, technology));
  if (missingTechnologies.length > 0) {
    score -= 20;
    pushIssue(issues, {
      code: 'missing_prompt_technology',
      severity: 'error',
      message: 'The plan omits technologies named in the planning prompt.',
      evidence: missingTechnologies,
    });
  }

  const missingMonitoringSlots = findMissingMonitoringSlots({ prompt, artifactText });
  if (missingMonitoringSlots.length > 0) {
    score -= 25;
    pushIssue(issues, {
      code: 'missing_implementation_detail_slots',
      severity: 'error',
      message: 'The plan is missing concrete monitoring implementation details.',
      evidence: missingMonitoringSlots.map((slot) => slot.label),
    });
  }

  const materialOpenQuestions = findMaterialOpenQuestions({ artifact, context, prompt });
  if (materialOpenQuestions.length > 0) {
    score -= 25;
    pushIssue(issues, {
      code: 'material_open_questions',
      severity: 'error',
      message: 'The plan leaves implementation-changing questions unresolved after generation.',
      evidence: materialOpenQuestions,
    });
  }

  const undecidedMaterialAlternatives = findUndecidedMaterialAlternatives(artifact);
  if (undecidedMaterialAlternatives.length > 0) {
    score -= 20;
    pushIssue(issues, {
      code: 'undecided_material_alternatives',
      severity: 'error',
      message: 'The plan keeps material implementation choices as alternatives instead of selecting one path.',
      evidence: undecidedMaterialAlternatives,
    });
  }

  const invalidMonitoringDataFlow = findInvalidMonitoringDataFlow(artifact);
  if (invalidMonitoringDataFlow.length > 0) {
    score -= 20;
    pushIssue(issues, {
      code: 'invalid_monitoring_data_flow',
      severity: 'error',
      message: 'The plan connects dashboard consumption directly to the OpenTelemetry collector instead of a backend API or stored stream.',
      evidence: invalidMonitoringDataFlow,
    });
  }

  if (
    hasPatternMatch(normalizedPromptText, [/monitor/, /performance/, /telemetry/, /eval/, /tool call/, /real[\s-]?time/, /graph/]) &&
    (artifact.requirements.length < 4 || artifact.implementationPhases.flatMap((phase) => phase.tasks).length < 5)
  ) {
    score -= 15;
    pushIssue(issues, {
      code: 'thin_complex_plan',
      severity: 'error',
      message: 'The plan does not break the complex monitoring request into enough concrete requirements and tasks.',
      evidence: [`${artifact.requirements.length} requirements`, `${artifact.implementationPhases.flatMap((phase) => phase.tasks).length} tasks`],
    });
  }

  if (hasPatternMatch(normalizedPromptText, [/monitor/, /telemetry/, /agent/]) && countTelemetrySignals(artifactText) < 3) {
    score -= 15;
    pushIssue(issues, {
      code: 'thin_telemetry_scope',
      severity: 'error',
      message: 'The plan does not name enough first-class telemetry records for the monitoring workflow.',
      evidence: ['Expected at least three of evals, tool calls, traces, latency, failures, cost, queue state, token usage, or run state.'],
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
export function buildPlanQualityFeedback(
  quality: AgentPlanningQuality,
  source?: { prompt: string; context?: AgentPlanningContext | null }
) {
  const anchors = source ? extractPlanningAnchors(source).slice(0, 8) : [];

  return [
    `The previous plan failed quality review with score ${quality.score}.`,
    'Regenerate the plan so every phase and task is specific to the prompt and planning context.',
    anchors.length > 0 ? `Required prompt anchors to reuse in phase titles, task descriptions, and acceptance criteria: ${anchors.join(', ')}.` : '',
    'Do not use generic Planning, Design, Development, Testing, Demo, or Launch phase templates unless the user explicitly requested those phases.',
    'Do not introduce unprovided stack choices as facts; put uncertain choices in assumptions or non-material notes.',
    'Do not leave exporter, realtime transport, graphing, telemetry, storage, retention, auth, or acceptance-test decisions in openQuestions.',
    'For monitoring plans, route dashboard reads through a backend API or stored stream; do not connect Next.js directly to an OpenTelemetry collector.',
    ...quality.issues.map((issue) => `${issue.code}: ${issue.message} Evidence: ${issue.evidence.join('; ')}`),
  ].filter(Boolean).join('\n');
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

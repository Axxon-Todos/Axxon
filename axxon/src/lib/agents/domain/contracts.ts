// Defines the stable agent-run contracts shared by routes, services, persistence, and workers.
export const agentRunTypes = ['planning', 'coding', 'planning_execution'] as const;

export type AgentRunType = (typeof agentRunTypes)[number];

export const agentRunStates = [
  'queued',
  'preparing',
  'awaiting_input',
  'awaiting_message',
  'planning',
  'awaiting_plan_review',
  'dispatching',
  'dispatched',
  'executing',
  'awaiting_result_review',
  'completed',
  'failed',
  'cancelled',
] as const;

export type AgentRunState = (typeof agentRunStates)[number];

export type AgentRunEventType =
  | 'run.created'
  | 'worker.claimed'
  | 'planning.started'
  | 'input.required'
  | 'input.submitted'
  | 'message.required'
  | 'message.submitted'
  | 'planning.superseded'
  | 'plan.generated'
  | 'plan.approved'
  | 'changes.requested'
  | 'dispatch.delivered'
  | 'execution.started'
  | 'result.review_requested'
  | 'result.approved'
  | 'run.failed'
  | 'run.retried'
  | 'run.cancelled';

export type AgentActorType = 'user' | 'worker' | 'executor' | 'system';

export type AgentCapability =
  | 'view'
  | 'submit_message'
  | 'submit_input'
  | 'request_changes'
  | 'approve_plan'
  | 'approve_result'
  | 'retry'
  | 'cancel';

export type AgentToolName = 'ask_clarification_questions';

export const agentQuestionCategories = [
  'scope',
  'technical',
  'constraints',
  'dependencies',
  'acceptance_criteria',
  'priority',
  'ux',
  'rollout',
] as const;

export type AgentQuestionCategory = (typeof agentQuestionCategories)[number];

export type AgentQuestionOption = {
  optionKey: string;
  label: string;
  description: string;
  isRecommended?: boolean;
};

export type AgentQuestion = {
  questionKey: string;
  category: AgentQuestionCategory;
  prompt: string;
  whyThisMatters: string;
  required: boolean;
  blocking: boolean;
  allowMultiple?: boolean;
  options: AgentQuestionOption[];
};

export type AgentClarificationAnswer = {
  questionKey: string;
  selectedOptionKey?: string;
  selectedOptionKeys?: string[];
  note?: string | null;
};

export type AgentTechnicalDecision = {
  area: string;
  choice: string;
  rationale: string;
  source: AgentTechnicalDecisionSource;
};

export const agentTechnicalDecisionSources = ['explicit', 'clarified', 'assumed'] as const;

export type AgentTechnicalDecisionSource = (typeof agentTechnicalDecisionSources)[number];

export const agentPlanningComplexities = ['low', 'medium', 'high', 'very_high'] as const;

export type AgentPlanningComplexity = (typeof agentPlanningComplexities)[number];

export type AgentPlanningQualityIssue = {
  code: string;
  severity: 'warning' | 'error';
  message: string;
  evidence: string[];
};

export type AgentPlanningQuality = {
  score: number;
  passed: boolean;
  issues: AgentPlanningQualityIssue[];
};

export type AgentPlanningContext = {
  objective: string | null;
  summary: string | null;
  targetOutcome: string | null;
  inScope: string[];
  outOfScope: string[];
  assumptions: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  knownRequirements: string[];
  unresolvedUnknowns: string[];
  blockingUnknowns: string[];
  affectedAreas: string[];
  risks: string[];
  dependencies: string[];
  technicalDecisions: AgentTechnicalDecision[];
  estimatedComplexity: AgentPlanningComplexity | null;
  planningConfidence: number;
};

export type AgentPlanningReadiness = {
  objectiveClear: boolean;
  scopeBounded: boolean;
  hasAcceptanceCriteria: boolean;
  knownRequirements: string[];
  unresolvedUnknowns: string[];
  blockingUnknowns: string[];
  confidence: number;
  recommendedNextAction: 'ask_questions' | 'complete_planning';
  reasonSummary: string[];
};

export const agentPlanningDecisionReasons = [
  'missing_objective',
  'scope_unbounded',
  'missing_acceptance_criteria',
  'blocking_unknowns',
  'low_confidence',
  'requirements_satisfied',
] as const;

export type AgentPlanningDecisionReason = (typeof agentPlanningDecisionReasons)[number];

export const agentPlanningDecisionActions = ['ask_questions', 'complete_planning', 'respond'] as const;

export type AgentPlanningDecisionAction = (typeof agentPlanningDecisionActions)[number];

export type AgentPlanningDecision = {
  action: AgentPlanningDecisionAction;
  reason: AgentPlanningDecisionReason;
};

export type AgentPlanningTurnAnalysis = {
  title: string | null;
  summary: string | null;
  assistantMessage: string | null;
  contextPatch: Partial<AgentPlanningContext>;
  knownRequirements: string[];
  unresolvedUnknowns: string[];
  blockingUnknowns: string[];
  resolvedQuestionKeys: string[];
  candidateQuestions: AgentQuestion[];
  confidence: number;
  decision: AgentPlanningDecision;
};

export type AgentRunMessage = {
  id: number;
  runId: number;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AgentPlanArtifact = {
  summary: string;
  objective: string;
  implementationDetails?: {
    dataFlow: string[];
    tooling: string[];
    integrations: string[];
    realtimeStrategy: string[];
    storageAndRetention: string[];
    observability: string[];
    securityAndAccess: string[];
  };
  scope: {
    inScope: string[];
    outOfScope: string[];
  };
  requirements: string[];
  assumptions: string[];
  constraints: string[];
  affectedAreas: string[];
  technicalDecisions: AgentTechnicalDecision[];
  implementationPhases: Array<{
    id: string;
    title: string;
    summary: string;
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      type: string;
      priority: 'low' | 'medium' | 'high';
      dependencyIds: string[];
      acceptanceCriteria: string[];
    }>;
  }>;
  risks: string[];
  successCriteria: string[];
  openQuestions: string[];
  notes: string[];
  quality?: AgentPlanningQuality;
};

export type AgentToolCallStatus = 'completed' | 'failed';

export type AgentToolCall = {
  id: number;
  runId: number;
  toolName: string;
  status: AgentToolCallStatus;
  reasonCode: AgentPlanningDecisionReason;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AgentRun = {
  id: number;
  organizationId: number;
  boardId: number;
  createdBy: number;
  runType: AgentRunType;
  title: string;
  prompt: string;
  state: AgentRunState;
  version: number;
  questions: AgentQuestion[];
  planningContext: AgentPlanningContext;
  readiness: AgentPlanningReadiness;
  clarificationTurnCount: number;
  planArtifact: AgentPlanArtifact | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentRunEvent = {
  id: number;
  runId: number;
  type: AgentRunEventType;
  fromState: AgentRunState | null;
  toState: AgentRunState;
  actorType: AgentActorType;
  actorId: number | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type AgentRunDetail = AgentRun & {
  events: AgentRunEvent[];
  messages: AgentRunMessage[];
  toolCalls: AgentToolCall[];
  capabilities: AgentCapability[];
};

export type CreateAgentRunCommand = { prompt: string; runType?: AgentRunType };
export type SubmitAgentInputCommand = { answers: AgentClarificationAnswer[] };
export type SubmitAgentMessageCommand = { message: string };
export type RequestAgentChangesCommand = { feedback: string };

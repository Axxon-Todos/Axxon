// Defines shared frontend agent-run types for the planning workspace and org-scoped API clients.
export type AgentRunType = 'planning' | 'coding' | 'planning_execution';

export type AgentRunState =
  | 'queued'
  | 'preparing'
  | 'awaiting_input'
  | 'planning'
  | 'awaiting_plan_review'
  | 'dispatching'
  | 'dispatched'
  | 'executing'
  | 'awaiting_result_review'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentCapability =
  | 'view'
  | 'submit_input'
  | 'request_changes'
  | 'approve_plan'
  | 'approve_result'
  | 'retry'
  | 'cancel';

export type AgentQuestionOption = {
  optionKey: string;
  label: string;
  description: string;
  isRecommended?: boolean;
};

export type AgentQuestion = {
  questionKey: string;
  category: string;
  prompt: string;
  whyThisMatters: string;
  required: boolean;
  blocking: boolean;
  options: AgentQuestionOption[];
};

export type AgentClarificationAnswer = {
  questionKey: string;
  selectedOptionKey: string;
  note?: string | null;
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

export type AgentTechnicalDecision = {
  area: string;
  choice: string;
  rationale: string;
  source: 'explicit' | 'clarified' | 'assumed';
};

export type AgentPlanArtifact = {
  summary: string;
  objective: string;
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
};

export type AgentToolCall = {
  id: number;
  runId: number;
  toolName: string;
  status: 'completed' | 'failed';
  reasonCode: string;
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
  type: string;
  fromState: AgentRunState | null;
  toState: AgentRunState;
  actorType: string;
  actorId: number | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type AgentRunDetail = AgentRun & {
  events: AgentRunEvent[];
  toolCalls: AgentToolCall[];
  capabilities: AgentCapability[];
};

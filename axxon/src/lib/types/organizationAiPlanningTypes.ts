// Describes board-bound AI planning sessions, structured planner state, and planning API contracts.
export type PlanningSessionState =
  | 'queued'
  | 'analyzing'
  | 'clarifying'
  | 'planning'
  | 'plan_generated'
  | 'failed';

export type PlanningQuestionCategory =
  | 'scope'
  | 'technical'
  | 'constraints'
  | 'dependencies'
  | 'acceptance_criteria'
  | 'priority'
  | 'ux'
  | 'rollout';

export type PlanningQuestionStatus = 'open' | 'answered' | 'superseded';

export type PlanningSessionMessageRole = 'user' | 'assistant';

export type PlanningSessionMessageKind =
  | 'user_input'
  | 'clarification_questions'
  | 'planner_status'
  | 'plan_summary';

export type PlanningSessionMessageStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type PlanningComplexity = 'low' | 'medium' | 'high' | 'very_high';

export type PlanningNextAction = 'ask_clarification' | 'generate_plan';
export type PlanningExecutorKind =
  | 'local_ollama'
  | 'external_llm'
  | 'headless_agent';
export type PlanningRunState =
  | 'queued'
  | 'running'
  | 'waiting_for_clarification'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type PlanningRunStage =
  | 'queued'
  | 'analyzing'
  | 'clarifying'
  | 'planning'
  | 'completed'
  | 'failed';

export type PlanningQuestionOption = {
  optionKey: string;
  label: string;
  description: string;
  isRecommended?: boolean;
};

export type PlanningTechnicalDecision = {
  area: string;
  choice: string;
  rationale: string;
  source: 'explicit' | 'clarified' | 'assumed';
};

export type PlanningContext = {
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
  technicalDecisions?: PlanningTechnicalDecision[];
  estimatedComplexity: PlanningComplexity | null;
  planningConfidence: number;
};

export type PlanningReadiness = {
  objectiveClear: boolean;
  scopeBounded: boolean;
  hasAcceptanceCriteria: boolean;
  knownRequirements: string[];
  unresolvedUnknowns: string[];
  blockingUnknowns: string[];
  confidence: number;
  recommendedNextAction: PlanningNextAction;
  reasonSummary: string[];
};

export type PlanningSession = {
  id: number;
  organization_id: number;
  board_id: number;
  created_by: number;
  title: string;
  summary: string;
  original_prompt: string;
  planner_state: PlanningSessionState;
  clarification_turn_count: number;
  created_at: string;
  updated_at: string;
};

export type PlanningRun = {
  id: number;
  session_id: number;
  trigger_message_id: number;
  status_message_id: number;
  executor_kind: PlanningExecutorKind;
  state: PlanningRunState;
  stage: PlanningRunStage;
  attempt_count: number;
  provider_job_id: string | null;
  metadata_json: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanningSessionMessage = {
  id: number;
  session_id: number;
  role: PlanningSessionMessageRole;
  message_kind: PlanningSessionMessageKind;
  content: string;
  sequence_number: number;
  status: PlanningSessionMessageStatus;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PlanningQuestion = {
  id: number;
  session_id: number;
  question_key: string;
  category: PlanningQuestionCategory;
  question_text: string;
  why_this_matters: string;
  options_json: PlanningQuestionOption[];
  selected_option_key: string | null;
  answer_note: string | null;
  is_required: boolean;
  is_blocking: boolean;
  status: PlanningQuestionStatus;
  asked_in_message_id: number | null;
  answered_in_message_id: number | null;
  asked_at: string | null;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanningPlanTask = {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  dependencyIds: string[];
  acceptanceCriteria: string[];
};

export type PlanningPlanPhase = {
  id: string;
  title: string;
  summary: string;
  tasks: PlanningPlanTask[];
};

export type PlanningPlanArtifact = {
  summary: string;
  objective: string;
  scope: {
    inScope: string[];
    outOfScope: string[];
  };
  assumptions: string[];
  constraints: string[];
  affectedAreas: string[];
  technicalDecisions?: PlanningTechnicalDecision[];
  implementationPhases: PlanningPlanPhase[];
  risks: string[];
  successCriteria: string[];
  openQuestions: string[];
};

export type PlanningSessionDetail = {
  session: PlanningSession;
  messages: PlanningSessionMessage[];
  questions: PlanningQuestion[];
  context: PlanningContext;
  readiness: PlanningReadiness;
  planArtifact: PlanningPlanArtifact | null;
  activeRun: PlanningRun | null;
};

export type PlanningSessionCreateRequest = {
  content: string;
};

export type PlanningSessionFreeformMessageRequest = {
  mode: 'freeform';
  content: string;
};

export type PlanningQuestionAnswerInput = {
  questionKey: string;
  selectedOptionKey: string;
  note?: string | null;
};

export type PlanningSessionClarificationBatchRequest = {
  mode: 'clarification_batch';
  answers: PlanningQuestionAnswerInput[];
};

export type PlanningSessionMessageRequest =
  | PlanningSessionFreeformMessageRequest
  | PlanningSessionClarificationBatchRequest;

export type PlanningQuestionCandidate = {
  questionKey: string;
  question: string;
  category: PlanningQuestionCategory;
  whyThisMatters: string;
  options: PlanningQuestionOption[];
  required: boolean;
  blocking: boolean;
};

export type PlanningTurnAnalysis = {
  title: string | null;
  summary: string | null;
  contextPatch: Partial<PlanningContext>;
  knownRequirements: string[];
  unresolvedUnknowns: string[];
  blockingUnknowns: string[];
  resolvedQuestionKeys: string[];
  candidateQuestions: PlanningQuestionCandidate[];
  confidence: number;
  recommendedNextAction: PlanningNextAction;
};

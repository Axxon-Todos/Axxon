// Defines the stable agent-run contracts shared by routes, services, persistence, and workers.
export const agentRunStates = [
  'queued',
  'preparing',
  'awaiting_input',
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
  | 'submit_input'
  | 'request_changes'
  | 'approve_plan'
  | 'approve_result'
  | 'retry'
  | 'cancel';

export type AgentQuestion = {
  key: string;
  prompt: string;
  required: boolean;
  options: Array<{ key: string; label: string }>;
};

export type AgentPlanArtifact = {
  summary: string;
  implementationPhases: Array<{
    title: string;
    tasks: Array<{ title: string; acceptanceCriteria: string[] }>;
  }>;
  assumptions: string[];
  risks: string[];
};

export type AgentRun = {
  id: number;
  organizationId: number;
  boardId: number;
  createdBy: number;
  title: string;
  prompt: string;
  state: AgentRunState;
  version: number;
  questions: AgentQuestion[];
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
  capabilities: AgentCapability[];
};

export type CreateAgentRunCommand = { prompt: string };
export type SubmitAgentInputCommand = { answers: Record<string, string> };
export type RequestAgentChangesCommand = { feedback: string };

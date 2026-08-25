// Provides the authoritative, side-effect-free transition rules for every agent run.
import type { AgentRunEventType, AgentRunState, AgentToolName } from './contracts';

type Transition = {
  event: AgentRunEventType;
  from: AgentRunState;
  to: AgentRunState;
};

type AgentStateNode = {
  state: AgentRunState;
  allowedTools: AgentToolName[];
};

const transitions: Transition[] = [
  { event: 'worker.claimed', from: 'queued', to: 'preparing' },
  { event: 'planning.started', from: 'preparing', to: 'planning' },
  { event: 'input.required', from: 'planning', to: 'awaiting_input' },
  { event: 'input.submitted', from: 'awaiting_input', to: 'queued' },
  { event: 'message.required', from: 'planning', to: 'awaiting_message' },
  { event: 'message.submitted', from: 'awaiting_input', to: 'queued' },
  { event: 'message.submitted', from: 'awaiting_message', to: 'queued' },
  { event: 'planning.superseded', from: 'planning', to: 'queued' },
  { event: 'plan.generated', from: 'planning', to: 'awaiting_plan_review' },
  { event: 'plan.approved', from: 'awaiting_plan_review', to: 'dispatching' },
  { event: 'changes.requested', from: 'awaiting_plan_review', to: 'queued' },
  { event: 'dispatch.delivered', from: 'dispatching', to: 'dispatched' },
  { event: 'execution.started', from: 'dispatched', to: 'executing' },
  { event: 'result.review_requested', from: 'executing', to: 'awaiting_result_review' },
  { event: 'result.approved', from: 'awaiting_result_review', to: 'completed' },
  { event: 'run.retried', from: 'failed', to: 'queued' },
];

const cancellableStates = new Set<AgentRunState>([
  'queued', 'preparing', 'awaiting_input', 'planning', 'awaiting_plan_review',
  'dispatching', 'dispatched', 'executing', 'awaiting_result_review', 'failed',
]);

const stateNodes: Record<AgentRunState, AgentStateNode> = {
  queued: { state: 'queued', allowedTools: [] },
  preparing: { state: 'preparing', allowedTools: [] },
  awaiting_input: { state: 'awaiting_input', allowedTools: [] },
  awaiting_message: { state: 'awaiting_message', allowedTools: [] },
  planning: { state: 'planning', allowedTools: ['ask_clarification_questions'] },
  awaiting_plan_review: { state: 'awaiting_plan_review', allowedTools: [] },
  dispatching: { state: 'dispatching', allowedTools: [] },
  dispatched: { state: 'dispatched', allowedTools: [] },
  executing: { state: 'executing', allowedTools: [] },
  awaiting_result_review: { state: 'awaiting_result_review', allowedTools: [] },
  completed: { state: 'completed', allowedTools: [] },
  failed: { state: 'failed', allowedTools: [] },
  cancelled: { state: 'cancelled', allowedTools: [] },
};

export function getAgentStateNode(state: AgentRunState): AgentStateNode {
  return stateNodes[state];
}

export function getAllowedAgentToolNamesForState(state: AgentRunState): AgentToolName[] {
  return [...stateNodes[state].allowedTools];
}

export function resolveAgentTransition(
  state: AgentRunState,
  event: AgentRunEventType
): AgentRunState | null {
  if (event === 'run.cancelled') {
    return cancellableStates.has(state) ? 'cancelled' : null;
  }

  if (event === 'run.failed') {
    return state === 'completed' || state === 'cancelled' ? null : 'failed';
  }

  if (event === 'message.submitted' && ['queued', 'preparing', 'planning'].includes(state)) {
    return state;
  }

  return transitions.find((transition) => transition.from === state && transition.event === event)?.to ?? null;
}

export function assertAgentTransition(state: AgentRunState, event: AgentRunEventType) {
  const nextState = resolveAgentTransition(state, event);

  if (!nextState) {
    throw new Error(`Agent event "${event}" is not allowed from state "${state}"`);
  }

  return nextState;
}

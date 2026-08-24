// Provides the authoritative, side-effect-free transition rules for every agent run.
import type { AgentRunEventType, AgentRunState } from './contracts';

type Transition = {
  event: AgentRunEventType;
  from: AgentRunState;
  to: AgentRunState;
};

const transitions: Transition[] = [
  { event: 'worker.claimed', from: 'queued', to: 'preparing' },
  { event: 'planning.started', from: 'preparing', to: 'planning' },
  { event: 'input.required', from: 'planning', to: 'awaiting_input' },
  { event: 'input.submitted', from: 'awaiting_input', to: 'queued' },
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

  return transitions.find((transition) => transition.from === state && transition.event === event)?.to ?? null;
}

export function assertAgentTransition(state: AgentRunState, event: AgentRunEventType) {
  const nextState = resolveAgentTransition(state, event);

  if (!nextState) {
    throw new Error(`Agent event "${event}" is not allowed from state "${state}"`);
  }

  return nextState;
}

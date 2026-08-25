// Derives user-visible agent actions from authoritative state and board-level actor permissions.
import type { AgentCapability, AgentRunState } from './contracts';

export type AgentActorAccess = {
  isInitiator: boolean;
  isOrganizationOwner: boolean;
};

export function getAgentCapabilities(
  state: AgentRunState,
  access: AgentActorAccess
): AgentCapability[] {
  const capabilities: AgentCapability[] = ['view'];
  const canOperate = access.isInitiator || access.isOrganizationOwner;

  if (!canOperate) {
    return capabilities;
  }

  if (['queued', 'preparing', 'planning', 'awaiting_input', 'awaiting_message'].includes(state)) {
    capabilities.push('submit_message');
  }
  if (state === 'awaiting_input') capabilities.push('submit_input');
  if (state === 'awaiting_plan_review') capabilities.push('request_changes', 'approve_plan');
  if (state === 'awaiting_result_review') capabilities.push('approve_result');
  if (state === 'failed') capabilities.push('retry');
  if (!['completed', 'cancelled'].includes(state)) capabilities.push('cancel');

  return capabilities;
}

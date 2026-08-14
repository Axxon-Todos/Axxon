// Verifies the centralized agent lifecycle and user capability rules without database dependencies.
import { describe, expect, it } from 'vitest';
import { getAgentCapabilities } from '@/lib/agents/domain/capabilities';
import { assertAgentTransition, resolveAgentTransition } from '@/lib/agents/domain/stateMachine';

describe('agent run state machine', () => {
  it('allows the review-gated planning and dispatch lifecycle', () => {
    expect(assertAgentTransition('queued', 'worker.claimed')).toBe('preparing');
    expect(assertAgentTransition('preparing', 'planning.started')).toBe('planning');
    expect(assertAgentTransition('planning', 'plan.generated')).toBe('awaiting_plan_review');
    expect(assertAgentTransition('awaiting_plan_review', 'plan.approved')).toBe('dispatching');
    expect(assertAgentTransition('dispatching', 'dispatch.delivered')).toBe('dispatched');
  });

  it('rejects transitions that skip a required lifecycle node', () => {
    expect(resolveAgentTransition('queued', 'plan.approved')).toBeNull();
    expect(() => assertAgentTransition('completed', 'run.cancelled')).toThrow('not allowed');
  });

  it('gates operational capabilities to the initiator or organization owner', () => {
    expect(getAgentCapabilities('awaiting_plan_review', { isInitiator: false, isOrganizationOwner: false }))
      .toEqual(['view']);
    expect(getAgentCapabilities('awaiting_plan_review', { isInitiator: true, isOrganizationOwner: false }))
      .toEqual(['view', 'request_changes', 'approve_plan', 'cancel']);
    expect(getAgentCapabilities('failed', { isInitiator: false, isOrganizationOwner: true }))
      .toEqual(['view', 'retry', 'cancel']);
  });
});

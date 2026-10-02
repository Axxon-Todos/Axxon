// Verifies the centralized agent lifecycle and user capability rules without database dependencies.
import { describe, expect, it } from 'vitest';
import { getAgentCapabilities } from '@/lib/agents/domain/capabilities';
import {
  assertAgentTransition,
  getAllowedAgentToolNamesForState,
  getAgentStateNode,
  resolveAgentTransition,
} from '@/lib/agents/domain/stateMachine';
import { executeAgentTool, getAllowedAgentToolsForState } from '@/lib/agents/toolCalls/registry';

describe('agent run state machine', () => {
  it('allows the review-gated planning and dispatch lifecycle', () => {
    expect(assertAgentTransition('queued', 'worker.claimed')).toBe('preparing');
    expect(assertAgentTransition('preparing', 'planning.started')).toBe('planning');
    expect(assertAgentTransition('planning', 'input.required')).toBe('awaiting_input');
    expect(assertAgentTransition('awaiting_input', 'input.submitted')).toBe('queued');
    expect(assertAgentTransition('planning', 'message.required')).toBe('awaiting_message');
    expect(assertAgentTransition('awaiting_message', 'message.submitted')).toBe('queued');
    expect(assertAgentTransition('planning', 'planning.superseded')).toBe('queued');
    expect(assertAgentTransition('queued', 'worker.claimed')).toBe('preparing');
    expect(assertAgentTransition('preparing', 'planning.started')).toBe('planning');
    expect(assertAgentTransition('planning', 'plan.generated')).toBe('awaiting_plan_review');
    expect(assertAgentTransition('awaiting_plan_review', 'plan.approved')).toBe('dispatching');
    expect(assertAgentTransition('dispatching', 'dispatch.delivered')).toBe('dispatched');
  });

  it('rejects transitions that skip a required lifecycle node', () => {
    expect(resolveAgentTransition('queued', 'plan.approved')).toBeNull();
    expect(resolveAgentTransition('preparing', 'input.required')).toBeNull();
    expect(() => assertAgentTransition('completed', 'run.cancelled')).toThrow('not allowed');
  });

  it('gates operational capabilities to the initiator or organization owner', () => {
    expect(getAgentCapabilities('awaiting_plan_review', { isInitiator: false, isOrganizationOwner: false }))
      .toEqual(['view']);
    expect(getAgentCapabilities('awaiting_plan_review', { isInitiator: true, isOrganizationOwner: false }))
      .toEqual(['view', 'request_changes', 'approve_plan', 'cancel']);
    expect(getAgentCapabilities('planning', { isInitiator: true, isOrganizationOwner: false }))
      .toEqual(['view', 'submit_message', 'cancel']);
    expect(getAgentCapabilities('awaiting_message', { isInitiator: false, isOrganizationOwner: true }))
      .toEqual(['view', 'submit_message', 'cancel']);
    expect(getAgentCapabilities('failed', { isInitiator: false, isOrganizationOwner: true }))
      .toEqual(['view', 'retry', 'cancel']);
  });

  it('declares agent-callable tools on the current state node', () => {
    expect(getAgentStateNode('planning')).toEqual({
      state: 'planning',
      allowedTools: ['ask_clarification_questions'],
    });
    expect(getAllowedAgentToolNamesForState('queued')).toEqual([]);
    expect(getAllowedAgentToolsForState('planning').map((tool) => tool.name))
      .toEqual(['ask_clarification_questions']);
  });

  it('rejects tool execution from states that do not allow that tool', () => {
    expect(() => executeAgentTool({
      toolName: 'ask_clarification_questions',
      state: 'queued',
      input: {
        candidateQuestions: [],
        existingQuestions: [],
        readiness: {
          objectiveClear: false,
          scopeBounded: false,
          hasAcceptanceCriteria: false,
          knownRequirements: [],
          unresolvedUnknowns: [],
          blockingUnknowns: [],
          confidence: 0,
          recommendedNextAction: 'ask_questions',
          reasonSummary: ['Need more context.'],
        },
      },
    })).toThrow('not allowed');
  });
});

// Verifies the local Ollama provider prompts for and parses structured planner JSON.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzePlanningTurnWithOllama, generatePlanWithOllama } from '@/lib/agents/providers/ollama';
import type { AgentRun } from '@/lib/agents/domain';
import { createEmptyPlanningContext, createInitialPlanningReadiness } from '@/lib/agents/domain';

// Builds the minimum complete run snapshot needed by the provider payload.
function createPlanningRun(): AgentRun {
  return {
    id: 12,
    organizationId: 3,
    boardId: 4,
    createdBy: 5,
    runType: 'planning',
    title: 'Planner test',
    prompt: 'Plan the payment reconciliation ledger release.',
    state: 'planning',
    version: 1,
    questions: [],
    planningContext: createEmptyPlanningContext(),
    readiness: createInitialPlanningReadiness(),
    clarificationTurnCount: 0,
    planArtifact: null,
    failureMessage: null,
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T00:00:00.000Z',
  };
}

describe('Ollama planning provider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('parses minimal analysis JSON into the full planner structure', async () => {
    const mockedFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        message: {
          content: JSON.stringify({
            decision: { action: 'ask_questions', reason: 'low_confidence' },
          }),
        },
      }),
    });
    vi.stubGlobal('fetch', mockedFetch);

    const analysis = await analyzePlanningTurnWithOllama(createPlanningRun(), [], []);
    const requestBody = JSON.parse(String(mockedFetch.mock.calls[0][1]?.body)) as {
      format: string;
      messages: Array<{ role: string; content: string }>;
    };

    expect(analysis).toMatchObject({
      title: null,
      summary: null,
      assistantMessage: null,
      contextPatch: {},
      knownRequirements: [],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: [],
      candidateQuestions: [],
      confidence: 0,
      decision: { action: 'ask_questions', reason: 'low_confidence' },
    });
    expect(requestBody.format).toBe('json');
    expect(requestBody.messages[0].content).toContain('Required JSON shape');
    expect(requestBody.messages[0].content).toContain('Assume routine MVP defaults');
    expect(requestBody.messages[0].content).toContain('data exporter, realtime transport, telemetry scope, graphing stack, storage backend, retention window');
    expect(requestBody.messages[0].content).toContain('Never ask cards shaped like');
    expect(requestBody.messages[0].content).toContain('"contextPatch"');
    expect(requestBody.messages[0].content).toContain('"candidateQuestions"');
    expect(requestBody.messages[0].content).toContain('"assistantMessage"');
    expect(requestBody.messages[0].content).not.toContain('|');
  });

  it('normalizes copied enum unions before validating planning analysis', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mockedFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        message: {
          content: JSON.stringify({
            contextPatch: {
              objective: null,
            },
            decision: {
              action: 'ask_questions',
              reason: 'missing_objective|scope_unbounded|blocking_unknowns|low_confidence',
            },
          }),
        },
      }),
    });
    vi.stubGlobal('fetch', mockedFetch);

    const analysis = await analyzePlanningTurnWithOllama(createPlanningRun(), [], []);

    expect(analysis.decision).toEqual({
      action: 'ask_questions',
      reason: 'missing_objective',
    });
    expect(warnSpy).toHaveBeenCalledWith('[AGENT_PROVIDER_NORMALIZED_OUTPUT]', {
      diagnostics: [
        'Normalized copied decision.reason enum union "missing_objective|scope_unbounded|blocking_unknowns|low_confidence" to "missing_objective".',
      ],
    });
  });

  it('retries invalid analysis responses with a concrete JSON shape', async () => {
    const mockedFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              decision: { action: 'respond', reason: 'missing_objective' },
            }),
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              assistantMessage: 'What would you like me to plan?',
              decision: { action: 'respond', reason: 'missing_objective' },
            }),
          },
        }),
      });
    vi.stubGlobal('fetch', mockedFetch);

    const analysis = await analyzePlanningTurnWithOllama(createPlanningRun(), [], []);
    const retryRequestBody = JSON.parse(String(mockedFetch.mock.calls[1][1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const retryPrompt = retryRequestBody.messages.at(-1)?.content ?? '';

    expect(analysis.assistantMessage).toBe('What would you like me to plan?');
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(retryPrompt).toContain('assistantMessage');
    expect(retryPrompt).not.toContain('|');
  });

  it('sends plan quality feedback when regenerating weak artifacts', async () => {
    const mockedFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        message: {
          content: JSON.stringify({
            summary: 'Create a prompt-specific plan.',
            objective: 'Finalize a reliable planning agent loop.',
            scope: { inScope: ['Planning agent state machine'], outOfScope: [] },
            requirements: ['Persist focused plan quality diagnostics.'],
            assumptions: [],
            constraints: ['Keep backend code under src/lib/agents.'],
            affectedAreas: ['agent backend'],
            technicalDecisions: [],
            implementationPhases: [{
              id: 'quality-gate',
              title: 'Planning quality gate',
              summary: 'Reject generic generated plans.',
              tasks: [{
                id: 'evaluate-plan-quality',
                title: 'Evaluate plan quality',
                description: 'Score generated plans before they enter review.',
                type: 'implementation',
                priority: 'high',
                dependencyIds: [],
                acceptanceCriteria: ['Generic phase-template plans do not reach review.'],
              }],
            }],
            risks: [],
            successCriteria: ['Weak plans are regenerated or routed back for context.'],
            openQuestions: [],
            notes: [],
          }),
        },
      }),
    });
    vi.stubGlobal('fetch', mockedFetch);

    await generatePlanWithOllama(createPlanningRun(), [], [], {
      score: 45,
      passed: false,
      issues: [{
        code: 'generic_project_template',
        severity: 'error',
        message: 'The implementation plan resembles a generic project-management template.',
        evidence: ['Planning Phase'],
      }],
    });
    const requestBody = JSON.parse(String(mockedFetch.mock.calls[0][1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const qualityPrompt = requestBody.messages.at(-1)?.content ?? '';

    expect(requestBody.messages[0].content).toContain('Do not use generic Planning, Design, Development, Testing, Demo, Launch');
    expect(requestBody.messages[0].content).toContain('"implementationDetails"');
    expect(requestBody.messages[0].content).toContain('exporter/collector');
    expect(requestBody.messages[0].content).toContain('storage backend, retention window');
    expect(requestBody.messages[0].content).toContain('backend API/WebSocket service');
    expect(requestBody.messages[0].content).toContain('openQuestions must not include unresolved exporter');
    expect(qualityPrompt).toContain('previous plan failed quality review');
    expect(qualityPrompt).toContain('Required prompt anchors');
    expect(qualityPrompt).toContain('generic_project_template');
  });

  it('normalizes recoverable final artifact string arrays before validation', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mockedFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        message: {
          content: JSON.stringify({
            summary: 'Create a payment reconciliation ledger exception plan.',
            objective: 'Build the payment reconciliation ledger exception workflow.',
            scope: { inScope: ['Payment reconciliation exceptions'], outOfScope: [] },
            requirements: ['Operators can review ledger mismatches.'],
            assumptions: [{ text: 'Existing payment ledger records are available.' }],
            constraints: ['Keep backend code under src/lib/agents.'],
            affectedAreas: ['agent backend'],
            technicalDecisions: [],
            implementationPhases: [{
              id: 'ledger-exceptions',
              title: 'Ledger exceptions',
              summary: 'Implement payment reconciliation exception review.',
              tasks: [{
                id: 'exception-review',
                title: 'Exception review',
                description: 'Add tasks for operator review of ledger mismatches.',
                type: 'implementation',
                priority: 'high',
                dependencyIds: [],
                acceptanceCriteria: [{ criterion: 'Operators can filter payment reconciliation exceptions.' }],
              }],
            }],
            risks: [],
            successCriteria: ['Ledger exception review is traceable.'],
            openQuestions: [],
            notes: [],
          }),
        },
      }),
    });
    vi.stubGlobal('fetch', mockedFetch);

    const artifact = await generatePlanWithOllama(createPlanningRun(), [], []);

    expect(artifact.assumptions).toEqual(['Existing payment ledger records are available.']);
    expect(artifact.implementationPhases[0]?.tasks[0]?.acceptanceCriteria).toEqual([
      'Operators can filter payment reconciliation exceptions.',
    ]);
    expect(warnSpy).toHaveBeenCalledWith('[AGENT_PROVIDER_NORMALIZED_OUTPUT]', {
      diagnostics: expect.arrayContaining([
        'Normalized assumptions[0] to "Existing payment ledger records are available.".',
        'Normalized implementationPhases[0].tasks[0].acceptanceCriteria[0] to "Operators can filter payment reconciliation exceptions.".',
      ]),
    });
  });
});

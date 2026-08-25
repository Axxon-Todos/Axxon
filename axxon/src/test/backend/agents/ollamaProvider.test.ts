// Verifies the local Ollama provider prompts for and parses structured planner JSON.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzePlanningTurnWithOllama } from '@/lib/agents/providers/ollama';
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
    prompt: 'Plan the first release.',
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
});

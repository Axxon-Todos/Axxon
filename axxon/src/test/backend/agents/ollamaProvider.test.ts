// Verifies the local Ollama provider prompts for and parses structured planner JSON.
import { describe, expect, it, vi } from 'vitest';
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
  });
});

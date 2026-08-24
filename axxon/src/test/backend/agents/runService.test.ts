// Verifies the typed planning-agent loop, clarification tool calls, and final plan transition.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedPublishBoardUpdate } = vi.hoisted(() => ({
  mockedPublishBoardUpdate: vi.fn(),
}));

vi.mock('@/lib/wsServer', () => ({
  publishBoardUpdate: mockedPublishBoardUpdate,
}));

import {
  applyWorkerPlanningAnalysis,
  claimAgentRunForWork,
  completeWorkerPlanning,
  createAgentRun,
  getAgentRunDetail,
  startAgentPlanningTurn,
  submitAgentInput,
} from '@/lib/agents/application/runService';
import type { AgentPlanArtifact, AgentPlanningTurnAnalysis } from '@/lib/agents/domain';
import { AgentRepository } from '@/lib/agents/infrastructure/repository';
import { BadRequestError } from '@/lib/utils/apiErrors';
import { addBoardMember, createBoardRecord, createOrganizationRecord, createUser } from '../factories';
import { resetDatabase } from '../db';

async function createBoardAgentFixture() {
  const user = await createUser();
  const organization = await createOrganizationRecord({ createdBy: user.id });
  const board = await createBoardRecord({ createdBy: user.id, organizationId: organization.id });
  await addBoardMember(board.id, user.id);

  return { board, organization, user };
}

function createAskAnalysis(): AgentPlanningTurnAnalysis {
  return {
    title: 'Planning agent loop',
    summary: 'Finalize the planning agent loop.',
    contextPatch: {
      objective: 'Finalize a reliable planning agent loop.',
      inScope: ['Planning agent state machine', 'Clarification tool calls'],
      knownRequirements: ['Keep the agent backend under src/lib/agents'],
    },
    knownRequirements: ['Keep the agent backend under src/lib/agents'],
    unresolvedUnknowns: ['first-release success criteria'],
    blockingUnknowns: ['first-release success criteria'],
    resolvedQuestionKeys: [],
    candidateQuestions: [{
      questionKey: 'first-release-success-bar',
      category: 'acceptance_criteria',
      prompt: 'What should count as success for the first release?',
      whyThisMatters: 'The plan needs a clear success bar before it can choose implementation depth.',
      required: true,
      blocking: true,
      options: [
        { optionKey: 'end-to-end-demo', label: 'End-to-end demo', description: 'Prove the flow works from prompt to plan.', isRecommended: true },
        { optionKey: 'production-ready-slice', label: 'Production slice', description: 'Require hardened behavior and operational checks.' },
        { optionKey: 'exploratory-prototype', label: 'Prototype', description: 'Validate the concept before hardening.' },
      ],
    }],
    confidence: 0.55,
    decision: { action: 'ask_questions', reason: 'missing_acceptance_criteria' },
  };
}

function createCompleteAnalysis(): AgentPlanningTurnAnalysis {
  return {
    title: 'Planning agent loop',
    summary: 'Finalize the planning agent loop.',
    contextPatch: {
      acceptanceCriteria: ['A planning run asks structured questions until ready, then generates a reviewable plan.'],
      outOfScope: ['Autonomous code execution'],
      constraints: ['Use org-scoped agent APIs'],
      technicalDecisions: [{
        area: 'state machine',
        choice: 'CAS-guarded planning transitions',
        rationale: 'The worker must not skip planning lifecycle nodes.',
        source: 'clarified',
      }],
      planningConfidence: 0.85,
    },
    knownRequirements: ['Keep the agent backend under src/lib/agents'],
    unresolvedUnknowns: [],
    blockingUnknowns: [],
    resolvedQuestionKeys: ['first-release-success-bar'],
    candidateQuestions: [],
    confidence: 0.85,
    decision: { action: 'complete_planning', reason: 'requirements_satisfied' },
  };
}

function createPlanArtifact(): AgentPlanArtifact {
  return {
    summary: 'Implement a schema-driven planning loop with durable clarification history.',
    objective: 'Finalize a reliable planning agent loop.',
    scope: {
      inScope: ['Planning agent state machine', 'Clarification tool calls'],
      outOfScope: ['Autonomous code execution'],
    },
    requirements: ['Ask structured questions until deterministic readiness is satisfied.'],
    assumptions: ['The UI will consume the current question snapshot later.'],
    constraints: ['Keep backend code under src/lib/agents.'],
    affectedAreas: ['agent backend'],
    technicalDecisions: [{
      area: 'state machine',
      choice: 'CAS-guarded planning transitions',
      rationale: 'The worker must not skip lifecycle nodes.',
      source: 'clarified',
    }],
    implementationPhases: [{
      id: 'phase-planning-loop',
      title: 'Planning loop',
      summary: 'Wire analysis, clarification, and final plan generation.',
      tasks: [{
        id: 'task-state-machine',
        title: 'Update state machine',
        description: 'Require planning before input or plan review transitions.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['The loop reaches awaiting_plan_review only after plan generation.'],
      }],
    }],
    risks: ['Provider output can fail schema validation.'],
    successCriteria: ['A planning run reaches awaiting_plan_review with a persisted plan.'],
    openQuestions: [],
    notes: ['No GitHub writes are performed in this phase.'],
  };
}

describe('agent planning run service', () => {
  beforeEach(async () => {
    mockedPublishBoardUpdate.mockResolvedValue(undefined);
    await resetDatabase();
  });

  it('asks clarification questions until readiness allows final plan generation', async () => {
    const { board, organization, user } = await createBoardAgentFixture();
    const created = await createAgentRun({
      organizationId: organization.id,
      boardId: board.id,
      userId: user.id,
      data: { prompt: 'Finalize the planning agent loop', runType: 'planning' },
    });

    const claimed = await claimAgentRunForWork(created.id);
    expect(claimed?.state).toBe('preparing');
    const planningRun = await startAgentPlanningTurn(created.id);
    expect(planningRun.state).toBe('planning');

    const firstOutcome = await applyWorkerPlanningAnalysis(created.id, createAskAnalysis());
    expect(firstOutcome?.action).toBe('await_input');

    const awaitingInput = await getAgentRunDetail({
      organizationId: organization.id,
      boardId: board.id,
      runId: created.id,
      userId: user.id,
    });
    expect(awaitingInput.state).toBe('awaiting_input');
    expect(awaitingInput.questions).toHaveLength(1);
    expect(awaitingInput.questions[0]?.options.map((option) => option.optionKey)).toContain('none-of-the-above');
    expect(awaitingInput.toolCalls).toHaveLength(1);
    expect(awaitingInput.toolCalls[0]?.toolName).toBe('ask_clarification_questions');

    await submitAgentInput({
      organizationId: organization.id,
      boardId: board.id,
      runId: created.id,
      userId: user.id,
      data: {
        answers: [{
          questionKey: 'first-release-success-bar',
          selectedOptionKey: 'end-to-end-demo',
          note: 'Use API smoke testing as the local success bar.',
        }],
      },
    });

    await claimAgentRunForWork(created.id);
    await startAgentPlanningTurn(created.id);
    const secondOutcome = await applyWorkerPlanningAnalysis(created.id, createCompleteAnalysis());
    expect(secondOutcome?.action).toBe('generate_plan');

    await completeWorkerPlanning(created.id, createPlanArtifact(), secondOutcome!.decision);
    const completedPlanning = await AgentRepository.getRun(created.id);
    expect(completedPlanning?.state).toBe('awaiting_plan_review');
    expect(completedPlanning?.planArtifact?.summary).toContain('schema-driven planning loop');
    expect(mockedPublishBoardUpdate).toHaveBeenCalledWith(String(board.id), {
      type: 'agent:run:updated',
      payload: expect.objectContaining({
        run: expect.objectContaining({
          id: created.id,
          boardId: board.id,
        }),
      }),
    });
  });

  it('rejects reserved non-planning run types in this phase', async () => {
    const { board, organization, user } = await createBoardAgentFixture();

    await expect(createAgentRun({
      organizationId: organization.id,
      boardId: board.id,
      userId: user.id,
      data: { prompt: 'Implement the task', runType: 'coding' },
    })).rejects.toBeInstanceOf(BadRequestError);
  });
});

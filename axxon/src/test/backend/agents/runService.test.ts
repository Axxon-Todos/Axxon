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
  requestWorkerPlanQualityInput,
  startAgentPlanningTurn,
  submitAgentInput,
  submitAgentRunMessage,
  supersedeWorkerPlanning,
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
    assistantMessage: null,
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
      questionKey: 'planning-loop-input-behavior',
      category: 'ux',
      prompt: 'Which planning agent loop input behavior should the plan detail first?',
      whyThisMatters: 'The implementation plan needs the exact user input path that blocks the planning agent loop.',
      required: true,
      blocking: true,
      options: [
        { optionKey: 'structured-cards', label: 'Structured cards', description: 'Answer planning agent questions through a compact guided card batch.', isRecommended: true },
        { optionKey: 'message-composer', label: 'Message composer', description: 'Provide planning context through a free-form message path.' },
        { optionKey: 'hybrid-input', label: 'Hybrid input', description: 'Support both guided cards and free-form planning context.' },
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
    assistantMessage: null,
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

function createRespondAnalysis(): AgentPlanningTurnAnalysis {
  return {
    title: null,
    summary: null,
    assistantMessage: 'What would you like me to plan?',
    contextPatch: {},
    knownRequirements: [],
    unresolvedUnknowns: ['planning objective'],
    blockingUnknowns: ['planning objective'],
    resolvedQuestionKeys: [],
    candidateQuestions: [],
    confidence: 0.2,
    decision: { action: 'respond', reason: 'missing_objective' },
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
    expect(created.title).toBe('Planning Agent Loop');

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
          questionKey: 'planning-loop-input-behavior',
          selectedOptionKey: 'structured-cards',
          note: 'Use API smoke testing as the local success bar.',
        }],
      },
    });
    const answeredRun = await AgentRepository.getRun(created.id);
    expect(answeredRun?.planningContext.knownRequirements).toContain(
      'Which planning agent loop input behavior should the plan detail first?: Structured cards. Answer planning agent questions through a compact guided card batch. Note: Use API smoke testing as the local success bar.'
    );

    await claimAgentRunForWork(created.id);
    await startAgentPlanningTurn(created.id);
    const secondOutcome = await applyWorkerPlanningAnalysis(created.id, createCompleteAnalysis());
    expect(secondOutcome?.action).toBe('generate_plan');
    const generatingMessages = await AgentRepository.listMessages(created.id);
    expect(generatingMessages.at(-1)?.content).toBe('I have enough context and am generating the implementation plan.');
    expect(generatingMessages.at(-1)?.metadata).toMatchObject({
      kind: 'planning_progress',
      stage: 'generating_plan',
    });

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

  it('creates a brief planning title before worker analysis', async () => {
    const { board, organization, user } = await createBoardAgentFixture();
    const prompt = 'can we make a fintech dashboard that tracks all payments reconciliation and ledgers with operator exception review';

    const created = await createAgentRun({
      organizationId: organization.id,
      boardId: board.id,
      userId: user.id,
      data: { prompt, runType: 'planning' },
    });

    expect(created.title).toBe('Fintech Dashboard Tracks Payments Reconciliation Ledgers Operator');
    expect(created.title).not.toBe(prompt.slice(0, 120));
    expect(created.messages[0]?.content).toBe(prompt);
  });

  it('asks for a planning objective with a message instead of question cards for vague prompts', async () => {
    const { board, organization, user } = await createBoardAgentFixture();
    const created = await createAgentRun({
      organizationId: organization.id,
      boardId: board.id,
      userId: user.id,
      data: { prompt: 'hi', runType: 'planning' },
    });

    await claimAgentRunForWork(created.id);
    await startAgentPlanningTurn(created.id);
    const outcome = await applyWorkerPlanningAnalysis(created.id, createRespondAnalysis());
    expect(outcome?.action).toBe('await_message');

    const awaitingMessage = await getAgentRunDetail({
      organizationId: organization.id,
      boardId: board.id,
      runId: created.id,
      userId: user.id,
    });
    expect(awaitingMessage.state).toBe('awaiting_message');
    expect(awaitingMessage.questions).toEqual([]);
    expect(awaitingMessage.capabilities).toContain('submit_message');
    expect(awaitingMessage.messages.map((message) => message.content)).toContain('What would you like me to plan?');
  });

  it('returns to message input when generated plans fail quality review', async () => {
    const { board, organization, user } = await createBoardAgentFixture();
    const created = await createAgentRun({
      organizationId: organization.id,
      boardId: board.id,
      userId: user.id,
      data: { prompt: 'Create a fintech dashboard that tracks payments reconciliation and ledgers', runType: 'planning' },
    });

    await claimAgentRunForWork(created.id);
    await startAgentPlanningTurn(created.id);
    const updated = await requestWorkerPlanQualityInput(created.id, {
      score: 42,
      passed: false,
      issues: [{
        code: 'generic_project_template',
        severity: 'error',
        message: 'The implementation plan resembles a generic project-management template.',
        evidence: ['Planning Phase'],
      }],
    });

    expect(updated?.state).toBe('awaiting_message');
    const detail = await getAgentRunDetail({
      organizationId: organization.id,
      boardId: board.id,
      runId: created.id,
      userId: user.id,
    });
    expect(detail.planArtifact).toBeNull();
    expect(detail.messages.at(-1)?.content).toContain('too generic');
    expect(detail.events.at(-1)?.payload).toMatchObject({ reason: 'plan_quality_failed' });
  });

  it('accepts free-form context while awaiting input and queues replanning', async () => {
    const { board, organization, user } = await createBoardAgentFixture();
    const created = await createAgentRun({
      organizationId: organization.id,
      boardId: board.id,
      userId: user.id,
      data: { prompt: 'Finalize the planning agent loop', runType: 'planning' },
    });

    await claimAgentRunForWork(created.id);
    await startAgentPlanningTurn(created.id);
    await applyWorkerPlanningAnalysis(created.id, createAskAnalysis());
    const updated = await submitAgentRunMessage({
      organizationId: organization.id,
      boardId: board.id,
      runId: created.id,
      userId: user.id,
      data: { message: 'Actually include a compact carousel for question batches.' },
    });

    expect(updated.state).toBe('queued');
    expect(updated.questions).toEqual([]);
    expect(updated.readiness.reasonSummary).toEqual(['Waiting for the first planning analysis.']);
    expect(updated.messages.at(-1)?.content).toBe('Actually include a compact carousel for question batches.');
  });

  it('supersedes active planning after a newer user message arrives', async () => {
    const { board, organization, user } = await createBoardAgentFixture();
    const created = await createAgentRun({
      organizationId: organization.id,
      boardId: board.id,
      userId: user.id,
      data: { prompt: 'Finalize the planning agent loop', runType: 'planning' },
    });

    await claimAgentRunForWork(created.id);
    await startAgentPlanningTurn(created.id);
    const messaged = await submitAgentRunMessage({
      organizationId: organization.id,
      boardId: board.id,
      runId: created.id,
      userId: user.id,
      data: { message: 'Include message submission during planning.' },
    });
    expect(messaged.state).toBe('planning');

    const superseded = await supersedeWorkerPlanning(created.id);
    expect(superseded?.state).toBe('queued');
    const detail = await getAgentRunDetail({
      organizationId: organization.id,
      boardId: board.id,
      runId: created.id,
      userId: user.id,
    });
    expect(detail.events.map((event) => event.type)).toContain('planning.superseded');
    expect(detail.messages.at(-1)?.content).toBe('Include message submission during planning.');
  });
});

// Covers persisted planning-turn creation, retryable processing, and creator-only access rules.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedAnalyzePlanningTurn,
  mockedGeneratePlanningArtifact,
  mockedGeneratePlanningClarificationQuestions,
  mockedEnsureLocalOllamaPlanningReady,
  mockedPublishUserUpdate,
} = vi.hoisted(() => ({
  mockedAnalyzePlanningTurn: vi.fn(),
  mockedGeneratePlanningArtifact: vi.fn(),
  mockedGeneratePlanningClarificationQuestions: vi.fn(),
  mockedEnsureLocalOllamaPlanningReady: vi.fn(),
  mockedPublishUserUpdate: vi.fn(),
}));

vi.mock('@/lib/ai/planning', () => ({
  analyzePlanningTurn: mockedAnalyzePlanningTurn,
  generatePlanningArtifact: mockedGeneratePlanningArtifact,
  generatePlanningClarificationQuestions: mockedGeneratePlanningClarificationQuestions,
}));

vi.mock('@/lib/ai/localOllamaRuntime', () => ({
  ensureLocalOllamaPlanningReady: mockedEnsureLocalOllamaPlanningReady,
}));

vi.mock('@/lib/wsServer', () => ({
  publishUserUpdate: mockedPublishUserUpdate,
}));

import {
  createOrganizationAiPlanningSession,
  createOrganizationAiPlanningSessionMessage,
  getOrganizationAiPlanningSession,
  processQueuedPlanningRun,
  processOrganizationAiPlanningSession,
} from '@/lib/controllers/ai/organizationAiPlanningControllers';
import { StructuredAiResponseError } from '@/lib/ai/service';
import { ForbiddenError } from '@/lib/utils/apiErrors';

import { resetDatabase } from '../db';
import {
  addBoardMember,
  addOrganizationMember,
  createBoardRecord,
  createPlanningQuestionRecord,
  createPlanningRunRecord,
  createPlanningSessionMessageRecord,
  createPlanningSessionRecord,
  createOrganizationRecord,
  createUser,
} from '../factories';

describe('organizationAiPlanningControllers', () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.clearAllMocks();
    mockedEnsureLocalOllamaPlanningReady.mockResolvedValue({
      accelerationState: 'gpu',
      modelAvailable: true,
      planningReady: true,
      planningStatusLabel: 'Planning is using GPU acceleration.',
      processorLabel: '100% GPU',
    });
    mockedGeneratePlanningArtifact.mockResolvedValue({
      summary: 'Build the planning mode in phases.',
      objective: 'Ship board-bound planning mode.',
      scope: {
        inScope: ['planning mode'],
        outOfScope: ['task auto-creation'],
      },
      assumptions: ['Existing assistant remains untouched.'],
      constraints: ['No repo awareness in this phase.'],
      affectedAreas: ['frontend', 'backend'],
      implementationPhases: [
        {
          id: 'phase-1',
          title: 'Backend foundation',
          summary: 'Add planning persistence and orchestration.',
          tasks: [
            {
              id: 'task-1',
              title: 'Persist sessions',
              description: 'Add planning session tables and models.',
              type: 'backend',
              priority: 'high',
              dependencyIds: [],
              acceptanceCriteria: ['Planning sessions persist per board.'],
            },
          ],
        },
      ],
      risks: ['Local model JSON quality'],
      successCriteria: ['Users can generate a structured plan.'],
      openQuestions: [],
    });
    mockedGeneratePlanningClarificationQuestions.mockResolvedValue([]);
  });

  it('creates a board-bound planning session and persists a pending planner turn immediately', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const detail = await createOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionUserId: owner.id,
      data: {
        content: 'Plan the next phase of the AI workspace.',
      },
    });

    expect(detail.session.board_id).toBe(Number(board.id));
    expect(detail.session.planner_state).toBe('queued');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        executor_kind: 'local_ollama',
        stage: 'queued',
        state: 'queued',
      })
    );
    expect(detail.messages).toHaveLength(2);
    expect(detail.messages[0]).toEqual(
      expect.objectContaining({
        role: 'user',
        message_kind: 'user_input',
        status: 'completed',
      })
    );
    expect(detail.messages[1]).toEqual(
      expect.objectContaining({
        role: 'assistant',
        message_kind: 'planner_status',
        content: 'Queued the planning run and waiting for the executor to start...',
        status: 'pending',
      })
    );
    expect(detail.planArtifact).toBeNull();
    expect(mockedAnalyzePlanningTurn).not.toHaveBeenCalled();
    expect(mockedPublishUserUpdate).toHaveBeenCalledWith(
      owner.id,
      expect.objectContaining({
        type: 'planning:session:updated',
      })
    );
  });

  it('processes a pending planning turn into persisted clarification questions', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Planner workspace polish',
      summary: 'Refine the planning mode scope.',
      contextPatch: {
        objective: 'Ship planning mode',
        summary: 'Add a planning mode next to the assistant.',
        inScope: ['planning tab', 'session persistence'],
        acceptanceCriteria: ['Planning mode asks clarification questions'],
        affectedAreas: ['frontend', 'backend'],
        estimatedComplexity: 'high',
      },
      knownRequirements: ['Assistant mode must remain'],
      unresolvedUnknowns: ['Which board surface should own planning?'],
      blockingUnknowns: ['Which board surface should own planning?'],
      resolvedQuestionKeys: [],
      candidateQuestions: [
        {
          questionKey: 'scope-board-surface',
          question: 'Which board surface should own planning mode first?',
          category: 'scope',
          whyThisMatters: 'The board scope changes the API and workspace layout.',
          options: [
            {
              optionKey: 'org-ai-workspace',
              label: 'Org AI workspace',
              description: 'Keep planning in the existing org AI workspace.',
              isRecommended: true,
            },
            {
              optionKey: 'board-view',
              label: 'Board view',
              description: 'Attach the planner directly to the board view.',
            },
            {
              optionKey: 'new-screen',
              label: 'New screen',
              description: 'Create a brand new planning screen.',
            },
          ],
          required: true,
          blocking: true,
        },
      ],
      confidence: 0.46,
      recommendedNextAction: 'ask_clarification',
    });

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const pendingDetail = await createOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionUserId: owner.id,
      data: {
        content: 'Plan the next phase of the AI workspace.',
      },
    });

    const detail = (await processQueuedPlanningRun(pendingDetail.activeRun!.id))!;

    expect(detail.session.planner_state).toBe('clarifying');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'clarifying',
        state: 'waiting_for_clarification',
      })
    );
    expect(detail.messages.at(-1)).toEqual(
      expect.objectContaining({
        message_kind: 'clarification_questions',
        status: 'completed',
      })
    );
    expect(detail.questions).toHaveLength(1);
    expect(detail.questions[0]?.question_key).toBe('scope-board-surface');
    expect(detail.questions[0]?.options_json).toHaveLength(4);
    expect(detail.questions[0]?.options_json[0]?.isRecommended).toBe(true);
    expect(detail.questions[0]?.options_json.at(-1)?.optionKey).toBe('none-of-the-above');
    expect(detail.questions[0]?.options_json.at(-1)?.isRecommended).toBe(false);
    expect(detail.readiness.blockingUnknowns).toEqual([
      'Which board surface should own planning?',
    ]);
    expect(mockedEnsureLocalOllamaPlanningReady).toHaveBeenCalled();
  });

  it('persists a reply turn and can turn it into a structured plan artifact', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Planner workspace polish',
      summary: 'The scope is tight enough to plan now.',
      contextPatch: {
        objective: 'Ship planning mode',
        summary: 'Build the planning workspace.',
        inScope: ['planning tab', 'clarification loop'],
        outOfScope: ['task auto-creation'],
        acceptanceCriteria: ['Structured plan renders in UI'],
        constraints: ['No repo reads'],
        affectedAreas: ['frontend', 'backend'],
        estimatedComplexity: 'high',
      },
      knownRequirements: ['Assistant mode remains', 'Planning is board-bound'],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: ['scope-board-surface'],
      candidateQuestions: [],
      confidence: 0.9,
      recommendedNextAction: 'generate_plan',
    });

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'clarifying',
      clarificationTurnCount: 1,
      context: {
        objective: 'Ship planning mode',
        summary: 'Build the planning workspace.',
        targetOutcome: 'A structured plan output',
        inScope: ['planning tab'],
        outOfScope: ['task auto-creation'],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: ['Assistant mode remains'],
        unresolvedUnknowns: ['Which board surface should own planning?'],
        blockingUnknowns: ['Which board surface should own planning?'],
        affectedAreas: ['frontend'],
        risks: [],
        dependencies: [],
        estimatedComplexity: 'high',
        planningConfidence: 0.4,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: false,
        hasAcceptanceCriteria: false,
        knownRequirements: ['Assistant mode remains'],
        unresolvedUnknowns: ['Which board surface should own planning?'],
        blockingUnknowns: ['Which board surface should own planning?'],
        confidence: 0.4,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['Need one more answer.'],
      },
    });
    const clarificationMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'clarification_questions',
      content: 'I need one clarification.',
      sequenceNumber: 1,
      status: 'completed',
    });

    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'scope-board-surface',
      questionText: 'Which board surface should own planning mode first?',
      askedInMessageId: clarificationMessage.id,
    });

    const pendingReply = await createOrganizationAiPlanningSessionMessage({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionId: session.id,
      sessionUserId: owner.id,
      data: {
        mode: 'clarification_batch',
        answers: [
          {
            questionKey: 'scope-board-surface',
            selectedOptionKey: 'workspace-ui',
            note: 'Own it in the existing org AI workspace and anchor sessions to the selected board.',
          },
        ],
      },
    });

    expect(pendingReply.session.planner_state).toBe('queued');
    expect(pendingReply.activeRun).toEqual(
      expect.objectContaining({
        stage: 'queued',
        state: 'queued',
      })
    );
    expect(pendingReply.planArtifact).toBeNull();
    expect(pendingReply.messages.at(-1)).toEqual(
      expect.objectContaining({
        message_kind: 'planner_status',
        content: 'Queued the planning run and waiting for the executor to start...',
        status: 'pending',
      })
    );
    const clarificationAnswerMessage = pendingReply.messages.find(
      (message) =>
        message.role === 'user' && message.message_kind === 'user_input'
    );
    expect(clarificationAnswerMessage?.content).toContain('Answer: Workspace UI');
    expect(clarificationAnswerMessage?.content).not.toContain('Note:');
    expect(pendingReply.questions[0]).toEqual(
      expect.objectContaining({
        status: 'answered',
        selected_option_key: 'workspace-ui',
        answer_note:
          'Own it in the existing org AI workspace and anchor sessions to the selected board.',
      })
    );

    const detail = (await processQueuedPlanningRun(pendingReply.activeRun!.id))!;

    expect(detail.session.planner_state).toBe('plan_generated');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'completed',
        state: 'completed',
      })
    );
    expect(detail.planArtifact?.objective).toBe('Ship board-bound planning mode.');
    expect(detail.messages.at(-1)?.message_kind).toBe('plan_summary');
    expect(detail.questions[0]?.status).toBe('answered');
  });

  it('accepts clarification answers without notes and still advances into plan generation', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Planner workspace polish',
      summary: 'The scope is tight enough to plan now.',
      contextPatch: {
        objective: 'Ship planning mode',
        summary: 'Build the planning workspace.',
        inScope: ['planning tab', 'clarification loop'],
        outOfScope: ['task auto-creation'],
        acceptanceCriteria: ['Structured plan renders in UI'],
        constraints: ['No repo reads'],
        affectedAreas: ['frontend', 'backend'],
        estimatedComplexity: 'high',
      },
      knownRequirements: ['Assistant mode remains', 'Planning is board-bound'],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: ['scope-board-surface'],
      candidateQuestions: [],
      confidence: 0.9,
      recommendedNextAction: 'generate_plan',
    });

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'clarifying',
      clarificationTurnCount: 1,
      context: {
        objective: 'Ship planning mode',
        summary: 'Build the planning workspace.',
        targetOutcome: 'A structured plan output',
        inScope: ['planning tab'],
        outOfScope: ['task auto-creation'],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: ['Assistant mode remains'],
        unresolvedUnknowns: ['Which board surface should own planning?'],
        blockingUnknowns: ['Which board surface should own planning?'],
        affectedAreas: ['frontend'],
        risks: [],
        dependencies: [],
        estimatedComplexity: 'high',
        planningConfidence: 0.4,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: false,
        hasAcceptanceCriteria: false,
        knownRequirements: ['Assistant mode remains'],
        unresolvedUnknowns: ['Which board surface should own planning?'],
        blockingUnknowns: ['Which board surface should own planning?'],
        confidence: 0.4,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['Need one more answer.'],
      },
    });
    const clarificationMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'clarification_questions',
      content: 'I need one clarification.',
      sequenceNumber: 1,
      status: 'completed',
    });

    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'scope-board-surface',
      questionText: 'Which board surface should own planning mode first?',
      askedInMessageId: clarificationMessage.id,
    });

    const pendingReply = await createOrganizationAiPlanningSessionMessage({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionId: session.id,
      sessionUserId: owner.id,
      data: {
        mode: 'clarification_batch',
        answers: [
          {
            questionKey: 'scope-board-surface',
            selectedOptionKey: 'workspace-ui',
          },
        ],
      },
    });

    expect(pendingReply.session.planner_state).toBe('queued');
    expect(pendingReply.activeRun).toEqual(
      expect.objectContaining({
        stage: 'queued',
        state: 'queued',
      })
    );
    const clarificationAnswerMessage = pendingReply.messages.find(
      (message) =>
        message.role === 'user' && message.message_kind === 'user_input'
    );
    expect(clarificationAnswerMessage?.content).toContain('Answer: Workspace UI');
    expect(clarificationAnswerMessage?.content).not.toContain('Note:');
    expect(pendingReply.questions[0]).toEqual(
      expect.objectContaining({
        status: 'answered',
        selected_option_key: 'workspace-ui',
        answer_note: null,
      })
    );

    const detail = (await processQueuedPlanningRun(pendingReply.activeRun!.id))!;

    expect(detail.session.planner_state).toBe('plan_generated');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'completed',
        state: 'completed',
      })
    );
    expect(detail.planArtifact?.objective).toBe('Ship board-bound planning mode.');
  });

  it('keeps none-of-the-above notes in the clarification transcript summary', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'clarifying',
    });
    const clarificationMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'clarification_questions',
      content: 'I need one clarification.',
      sequenceNumber: 1,
      status: 'completed',
    });

    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'scope-board-surface',
      questionText: 'Which board surface should own planning mode first?',
      askedInMessageId: clarificationMessage.id,
    });

    const pendingReply = await createOrganizationAiPlanningSessionMessage({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionId: session.id,
      sessionUserId: owner.id,
      data: {
        mode: 'clarification_batch',
        answers: [
          {
            questionKey: 'scope-board-surface',
            selectedOptionKey: 'none-of-the-above',
            note: 'Create a board-level planning workspace that reuses the existing assistant shell.',
          },
        ],
      },
    });

    const clarificationAnswerMessage = pendingReply.messages.find(
      (message) =>
        message.role === 'user' && message.message_kind === 'user_input'
    );

    expect(clarificationAnswerMessage?.content).toContain('Answer: None of the above');
    expect(clarificationAnswerMessage?.content).toContain(
      'Note: Create a board-level planning workspace that reuses the existing assistant shell.'
    );
    expect(pendingReply.questions[0]).toEqual(
      expect.objectContaining({
        answer_note:
          'Create a board-level planning workspace that reuses the existing assistant shell.',
        selected_option_key: 'none-of-the-above',
        status: 'answered',
      })
    );
  });

  it('rejects freeform replies while a clarification batch is still open', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'clarifying',
    });
    const clarificationMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'clarification_questions',
      content: 'I need two quick decisions.',
      sequenceNumber: 1,
      status: 'completed',
    });

    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'scope-board-surface',
      questionText: 'Which board surface should own planning mode first?',
      askedInMessageId: clarificationMessage.id,
    });

    await expect(
      createOrganizationAiPlanningSessionMessage({
        organizationId: organization.id,
        boardId: Number(board.id),
        sessionId: session.id,
        sessionUserId: owner.id,
        data: {
          mode: 'freeform',
          content: 'Just figure it out from the context.',
        },
      })
    ).rejects.toThrow(
      'Complete the clarification cards before sending another planning message'
    );
  });

  it('reconciles answered clarifications out of blocking unknowns and generates a plan when the model signals readiness', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Clarify platform objectives',
      summary: 'The request is now bounded enough to plan.',
      contextPatch: {
        objective: 'Create a fintech event monitoring platform.',
        inScope: ['globe visualization', 'stock market monitoring'],
        acceptanceCriteria: ['A structured plan is generated for the platform build.'],
      },
      knownRequirements: [
        'Build the platform in Next.js',
        'Use Gemini as the LLM',
        'Include a dedicated stock market charts page',
      ],
      unresolvedUnknowns: ['Data Source for Stock Market Charts'],
      blockingUnknowns: ['Data Source for Stock Market Charts'],
      resolvedQuestionKeys: [],
      candidateQuestions: [],
      confidence: 0.2,
      recommendedNextAction: 'generate_plan',
    });

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'clarifying',
      clarificationTurnCount: 2,
      context: {
        objective: 'Create a fintech platform.',
        summary: 'Monitor world events and market impact.',
        targetOutcome: null,
        inScope: ['world events globe'],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: ['Build the platform in Next.js'],
        unresolvedUnknowns: ['Data Source for Stock Market Charts'],
        blockingUnknowns: ['Data Source for Stock Market Charts'],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: null,
        planningConfidence: 0,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: true,
        hasAcceptanceCriteria: false,
        knownRequirements: ['Build the platform in Next.js'],
        unresolvedUnknowns: ['Data Source for Stock Market Charts'],
        blockingUnknowns: ['Data Source for Stock Market Charts'],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['Need one more answer.'],
      },
    });
    const clarificationMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'clarification_questions',
      content: 'I need one clarification.',
      sequenceNumber: 1,
      status: 'completed',
    });

    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'stock-market-chart-data',
      questionText: 'Data Source for Stock Market Charts',
      askedInMessageId: clarificationMessage.id,
      answeredInMessageId: clarificationMessage.id,
      status: 'answered',
    });
    const answerMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'user',
      messageKind: 'user_input',
      content: 'Use a real-time API for chart data.',
      sequenceNumber: 2,
      status: 'completed',
    });
    const processingMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'planner_status',
      content: 'Analyzing the clarified request.',
      sequenceNumber: 3,
      status: 'pending',
      metadata: {
        stage: 'analyzing',
        userMessageId: answerMessage.id,
      },
    });
    const run = await createPlanningRunRecord({
      sessionId: session.id,
      triggerMessageId: answerMessage.id,
      statusMessageId: processingMessage.id,
    });

    const detail = (await processQueuedPlanningRun(run.id))!;

    expect(detail.session.planner_state).toBe('plan_generated');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'completed',
        state: 'completed',
      })
    );
    expect(detail.readiness.recommendedNextAction).toBe('generate_plan');
    expect(detail.readiness.blockingUnknowns).toEqual([]);
    expect(detail.readiness.confidence).toBe(0.2);
    expect(detail.messages.find((message) => message.id === processingMessage.id)).toEqual(
      expect.objectContaining({
        message_kind: 'plan_summary',
        status: 'completed',
      })
    );
  });

  it('derives a fallback objective from analysis summary before readiness evaluation', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Fintech event monitoring platform',
      summary:
        'Build a fintech platform that maps global events to stock market impact with realtime updates.',
      contextPatch: {
        inScope: ['Three.js globe', 'realtime event ingestion', 'stock market charts'],
        outOfScope: ['Automated trading execution'],
        acceptanceCriteria: ['A structured implementation plan is generated.'],
      },
      knownRequirements: [
        'Build the platform in Next.js',
        'Use Gemini as the LLM',
        'Include a dedicated realtime stock market charts page',
      ],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: [],
      candidateQuestions: [],
      confidence: 1,
      recommendedNextAction: 'generate_plan',
    });

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const pendingDetail = await createOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionUserId: owner.id,
      data: {
        content: 'Plan a fintech event monitoring platform with market impact visualization.',
      },
    });

    const detail = (await processQueuedPlanningRun(pendingDetail.activeRun!.id))!;

    expect(detail.session.planner_state).toBe('plan_generated');
    expect(detail.context.objective).toBe(
      'Build a fintech platform that maps global events to stock market impact with realtime updates.'
    );
    expect(detail.readiness.objectiveClear).toBe(true);
    expect(detail.readiness.recommendedNextAction).toBe('generate_plan');
  });

  it('generates a plan after clarified high-confidence turns even if the model still asks for clarification', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Fintech event monitoring platform',
      summary: 'The clarified request is ready to plan.',
      contextPatch: {
        objective: 'Build a fintech platform.',
        inScope: ['Three.js globe', 'Realtime event ingestion', 'Stock market charts'],
        outOfScope: ['Automated trading execution'],
        acceptanceCriteria: [
          'The first release shows event-to-market impact on a realtime dashboard.',
        ],
      },
      knownRequirements: [
        'Build the platform in Next.js',
        'Use Gemini as the LLM',
        'Include a dedicated stock market charts page',
      ],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: ['first-release-success-bar'],
      candidateQuestions: [],
      confidence: 1,
      recommendedNextAction: 'ask_clarification',
    });

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'clarifying',
      clarificationTurnCount: 1,
      context: {
        objective: 'Build a fintech platform.',
        summary: 'Monitor world events and market impact.',
        targetOutcome: null,
        inScope: ['world events globe'],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: ['Build the platform in Next.js'],
        unresolvedUnknowns: ['First release success bar'],
        blockingUnknowns: ['First release success bar'],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: null,
        planningConfidence: 0,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: true,
        hasAcceptanceCriteria: false,
        knownRequirements: ['Build the platform in Next.js'],
        unresolvedUnknowns: ['First release success bar'],
        blockingUnknowns: ['First release success bar'],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['Need one more answer.'],
      },
    });
    const clarificationMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'clarification_questions',
      content: 'I need one clarification.',
      sequenceNumber: 1,
      status: 'completed',
    });

    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'first-release-success-bar',
      questionText: 'What should count as success for the first release?',
      category: 'acceptance_criteria',
      askedInMessageId: clarificationMessage.id,
      answeredInMessageId: clarificationMessage.id,
      status: 'answered',
    });
    const answerMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'user',
      messageKind: 'user_input',
      content: 'The first release should prove the event-to-market dashboard end to end.',
      sequenceNumber: 2,
      status: 'completed',
    });
    const processingMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'planner_status',
      content: 'Analyzing the clarified request.',
      sequenceNumber: 3,
      status: 'pending',
      metadata: {
        stage: 'analyzing',
        userMessageId: answerMessage.id,
      },
    });
    const run = await createPlanningRunRecord({
      sessionId: session.id,
      triggerMessageId: answerMessage.id,
      statusMessageId: processingMessage.id,
    });

    const detail = (await processQueuedPlanningRun(run.id))!;

    expect(detail.session.planner_state).toBe('plan_generated');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'completed',
        state: 'completed',
      })
    );
    expect(detail.readiness.recommendedNextAction).toBe('generate_plan');
    expect(detail.readiness.blockingUnknowns).toEqual([]);
    expect(detail.readiness.unresolvedUnknowns).toEqual([]);
    expect(detail.readiness.confidence).toBe(1);
    expect(detail.messages.find((message) => message.id === processingMessage.id)).toEqual(
      expect.objectContaining({
        message_kind: 'plan_summary',
        status: 'completed',
      })
    );
  });

  it('preserves previously clarified scope when later analysis patches return empty scope arrays', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Rust monitoring platform',
      summary: 'The clarified request is ready to plan.',
      contextPatch: {
        inScope: [],
        outOfScope: [],
        acceptanceCriteria: [
          'The first release should visualize endpoint activity and AI model metrics.',
        ],
      },
      knownRequirements: [
        'Use Rust for the backend',
        'Render endpoint activity on a browser dashboard',
        'Track AI model metrics',
      ],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: ['first-release-boundary'],
      candidateQuestions: [],
      confidence: 0.9,
      recommendedNextAction: 'generate_plan',
    });

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'clarifying',
      clarificationTurnCount: 2,
      context: {
        objective: 'Build a Rust monitoring platform.',
        summary: 'Monitor endpoints and AI metrics.',
        targetOutcome: null,
        inScope: ['Endpoint monitoring', '3D dashboard', 'AI metrics view'],
        outOfScope: ['Automated remediation'],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: ['Use Rust for the backend'],
        unresolvedUnknowns: ['First release boundary'],
        blockingUnknowns: ['First release boundary'],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        technicalDecisions: [],
        estimatedComplexity: null,
        planningConfidence: 0,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: false,
        hasAcceptanceCriteria: false,
        knownRequirements: ['Use Rust for the backend'],
        unresolvedUnknowns: ['First release boundary'],
        blockingUnknowns: ['First release boundary'],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['Need a tighter first-release boundary.'],
      },
    });
    const clarificationMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'clarification_questions',
      content: 'I need one clarification.',
      sequenceNumber: 1,
      status: 'completed',
    });
    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'first-release-boundary',
      questionText: 'What should the first release boundary be?',
      category: 'scope',
      askedInMessageId: clarificationMessage.id,
      answeredInMessageId: clarificationMessage.id,
      status: 'answered',
    });
    const answerMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'user',
      messageKind: 'user_input',
      content: 'Keep the first release focused on monitoring and dashboards only.',
      sequenceNumber: 2,
      status: 'completed',
    });
    const processingMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'planner_status',
      content: 'Analyzing the clarified request.',
      sequenceNumber: 3,
      status: 'pending',
      metadata: {
        stage: 'analyzing',
        userMessageId: answerMessage.id,
      },
    });
    const run = await createPlanningRunRecord({
      sessionId: session.id,
      triggerMessageId: answerMessage.id,
      statusMessageId: processingMessage.id,
    });

    const detail = (await processQueuedPlanningRun(run.id))!;

    expect(detail.session.planner_state).toBe('plan_generated');
    expect(detail.context.inScope).toEqual([
      'Endpoint monitoring',
      '3D dashboard',
      'AI metrics view',
    ]);
    expect(detail.readiness.scopeBounded).toBe(true);
    expect(detail.readiness.recommendedNextAction).toBe('generate_plan');
  });

  it('keeps the first turn in clarification when the scope still lacks hard boundaries', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Rust monitoring platform',
      summary: 'The request sounds implementable, but the boundaries are still too soft.',
      contextPatch: {
        objective: 'Build a Rust monitoring platform.',
        inScope: ['Endpoint monitoring', '3D dashboard', 'AI metrics view'],
        acceptanceCriteria: ['A structured implementation plan is generated.'],
      },
      knownRequirements: [
        'Use Rust for the backend',
        'Render a 3D monitoring view',
        'Track AI model metrics',
      ],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: [],
      candidateQuestions: [],
      confidence: 1,
      recommendedNextAction: 'generate_plan',
    });

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const pendingDetail = await createOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionUserId: owner.id,
      data: {
        content: 'Plan a Rust monitoring platform for endpoints and AI metrics.',
      },
    });

    const detail = (await processQueuedPlanningRun(pendingDetail.activeRun!.id))!;

    expect(detail.session.planner_state).toBe('clarifying');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'clarifying',
        state: 'waiting_for_clarification',
      })
    );
    expect(detail.readiness.recommendedNextAction).toBe('ask_clarification');
    expect(detail.readiness.scopeBounded).toBe(false);
    expect(detail.questions[0]?.question_key).toBe('first-release-boundary');
  });

  it('asks clarification on the first turn even when analysis provides no cards or unknowns', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Rust monitoring platform',
      summary: 'The request still needs a tighter first-release definition.',
      contextPatch: {
        objective: 'Build a Rust monitoring platform.',
      },
      knownRequirements: ['Use Rust'],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: [],
      candidateQuestions: [],
      confidence: 0.3,
      recommendedNextAction: 'ask_clarification',
    });

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const pendingDetail = await createOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionUserId: owner.id,
      data: {
        content: 'Plan a Rust monitoring platform for endpoints and AI metrics.',
      },
    });

    const detail = (await processQueuedPlanningRun(pendingDetail.activeRun!.id))!;

    expect(detail.session.planner_state).toBe('clarifying');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'clarifying',
        state: 'waiting_for_clarification',
      })
    );
    expect(detail.messages.at(-1)).toEqual(
      expect.objectContaining({
        message_kind: 'clarification_questions',
        status: 'completed',
      })
    );
    expect(detail.questions.map((question) => question.question_key)).toEqual(
      expect.arrayContaining(['first-release-boundary', 'first-release-success-bar'])
    );
  });

  it('synthesizes clarification cards when model-generated fallback cards are unusable', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Planner workspace polish',
      summary: 'The request still needs one blocking decision.',
      contextPatch: {
        objective: 'Ship planning mode',
        inScope: ['planning tab'],
        acceptanceCriteria: ['The planner asks actionable follow-up questions.'],
      },
      knownRequirements: ['Planning remains board-bound'],
      unresolvedUnknowns: ['Hosting target for the planning service'],
      blockingUnknowns: ['Hosting target for the planning service'],
      resolvedQuestionKeys: [],
      candidateQuestions: [],
      confidence: 0.4,
      recommendedNextAction: 'ask_clarification',
    });
    mockedGeneratePlanningClarificationQuestions.mockResolvedValue([
      {
        questionKey: 'hosting-target',
        question: 'Hosting target for the planning service',
        category: 'constraints',
        whyThisMatters: 'The deployment target determines runtime and networking assumptions.',
        options: [
          {
            optionKey: 'docker',
            label: 'Docker',
            description: 'Run the planning service inside Docker.',
            isRecommended: true,
          },
          {
            optionKey: 'kubernetes',
            label: 'Kubernetes',
            description: 'Deploy the planning service on Kubernetes.',
          },
          {
            optionKey: 'docker',
            label: 'Docker again',
            description: 'Duplicate option to simulate an unusable fallback card set.',
          },
        ],
        required: true,
        blocking: true,
      },
    ]);

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const pendingDetail = await createOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionUserId: owner.id,
      data: {
        content: 'Plan the next phase of the AI workspace.',
      },
    });

    const detail = (await processQueuedPlanningRun(pendingDetail.activeRun!.id))!;

    expect(detail.session.planner_state).toBe('clarifying');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'clarifying',
        state: 'waiting_for_clarification',
      })
    );
    expect(detail.messages.at(-1)).toEqual(
      expect.objectContaining({
        message_kind: 'clarification_questions',
        status: 'completed',
      })
    );
    expect(detail.questions.map((question) => question.question_key)).toEqual(
      expect.arrayContaining([
        'first-release-boundary',
        'hosting-target-for-the-planning-service',
      ])
    );
  });

  it('falls back to a unique clarification card when every synthesized default collides', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Monitoring platform',
      summary: 'The request still needs one more direction-setting decision.',
      contextPatch: {
        objective: 'Build a monitoring platform.',
      },
      knownRequirements: ['Monitor endpoints'],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: [],
      candidateQuestions: [],
      confidence: 0.25,
      recommendedNextAction: 'ask_clarification',
    });

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'analyzing',
      originalPrompt: 'Plan a monitoring platform.',
    });
    const userMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'user',
      messageKind: 'user_input',
      content: 'Plan a monitoring platform.',
      sequenceNumber: 1,
      status: 'completed',
    });
    const processingMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'planner_status',
      content: 'Queued the planning run and waiting for the executor to start...',
      sequenceNumber: 2,
      status: 'pending',
    });
    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'first-release-boundary',
      questionText: 'What should the first release boundary be?',
      category: 'scope',
      askedInMessageId: processingMessage.id,
      status: 'answered',
      answeredInMessageId: userMessage.id,
    });
    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'first-release-success-bar',
      questionText: 'What should count as success for the first release?',
      category: 'acceptance_criteria',
      askedInMessageId: processingMessage.id,
      status: 'answered',
      answeredInMessageId: userMessage.id,
    });
    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'primary-outcome',
      questionText: 'Which primary outcome matters most for the first release?',
      category: 'priority',
      askedInMessageId: processingMessage.id,
      status: 'answered',
      answeredInMessageId: userMessage.id,
    });
    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'planning-direction',
      questionText: 'What should this first implementation plan optimize for?',
      category: 'priority',
      askedInMessageId: processingMessage.id,
      status: 'answered',
      answeredInMessageId: userMessage.id,
    });
    const run = await createPlanningRunRecord({
      sessionId: session.id,
      triggerMessageId: userMessage.id,
      statusMessageId: processingMessage.id,
      state: 'queued',
      stage: 'queued',
    });

    const detail = (await processQueuedPlanningRun(run.id))!;

    expect(detail.session.planner_state).toBe('clarifying');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'clarifying',
        state: 'waiting_for_clarification',
      })
    );
    expect(detail.questions.at(-1)).toEqual(
      expect.objectContaining({
        question_key: 'planning-direction-2',
        question_text:
          'What should this first implementation plan optimize for in the next implementation step?',
        status: 'open',
      })
    );
  });

  it('continues asking clarification questions after the nominal turn limit when readiness still has blockers', async () => {
    mockedAnalyzePlanningTurn.mockResolvedValue({
      title: 'Monitoring platform',
      summary: 'The request still lacks a clear success bar.',
      contextPatch: {
        objective: 'Build a monitoring platform.',
        inScope: ['Endpoint monitoring', '3D dashboard'],
        outOfScope: ['Automated remediation'],
      },
      knownRequirements: ['Monitor endpoints'],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: [],
      candidateQuestions: [],
      confidence: 1,
      recommendedNextAction: 'ask_clarification',
    });

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'clarifying',
      clarificationTurnCount: 5,
      originalPrompt: 'Plan a monitoring platform for endpoints and dashboards.',
      context: {
        objective: 'Build a monitoring platform.',
        summary: 'Monitor endpoints with dashboards.',
        targetOutcome: null,
        inScope: ['Endpoint monitoring', '3D dashboard'],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: ['Monitor endpoints'],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: null,
        planningConfidence: 0,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: true,
        hasAcceptanceCriteria: false,
        knownRequirements: ['Monitor endpoints'],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['Need one more success criterion.'],
      },
    });
    const userMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'user',
      messageKind: 'user_input',
      content: 'Plan a monitoring platform for endpoints and dashboards.',
      sequenceNumber: 1,
      status: 'completed',
    });
    const processingMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'planner_status',
      content: 'Analyzing the clarified request.',
      sequenceNumber: 2,
      status: 'pending',
      metadata: {
        stage: 'analyzing',
        userMessageId: userMessage.id,
      },
    });
    const run = await createPlanningRunRecord({
      sessionId: session.id,
      triggerMessageId: userMessage.id,
      statusMessageId: processingMessage.id,
    });

    const detailAfterLimit = (await processQueuedPlanningRun(run.id))!;

    expect(detailAfterLimit.session.planner_state).toBe('clarifying');
    expect(detailAfterLimit.activeRun).toEqual(
      expect.objectContaining({
        stage: 'clarifying',
        state: 'waiting_for_clarification',
      })
    );
    expect(detailAfterLimit.messages.at(-1)).toEqual(
      expect.objectContaining({
        message_kind: 'clarification_questions',
        status: 'completed',
      })
    );
    expect(detailAfterLimit.questions.at(-1)).toEqual(
      expect.objectContaining({
        question_key: 'first-release-success-bar',
        status: 'open',
      })
    );
    expect(detailAfterLimit.session.clarification_turn_count).toBe(6);
  });

  it('recovers a json parse failure during analysis into the next clarification batch when readiness still needs scope work', async () => {
    mockedAnalyzePlanningTurn.mockRejectedValue(
      new StructuredAiResponseError('Failed to analyze the planning session', {
        failureCode: 'json_parse_failed',
        responseExcerpt: 'not valid json',
      })
    );

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'clarifying',
      clarificationTurnCount: 3,
      context: {
        objective: 'Build a Rust monitoring platform.',
        summary: 'Monitor endpoints and AI metrics.',
        targetOutcome: null,
        inScope: [],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [
          'The first release should show endpoint activity and AI metrics.',
        ],
        knownRequirements: [
          'Use Rust for the backend',
          'Render endpoint activity visually',
          'Track AI model metrics',
        ],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        technicalDecisions: [],
        estimatedComplexity: null,
        planningConfidence: 0.9,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: false,
        hasAcceptanceCriteria: true,
        knownRequirements: [
          'Use Rust for the backend',
          'Render endpoint activity visually',
          'Track AI model metrics',
        ],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        confidence: 0.9,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['The first-release scope is still too loose.'],
      },
    });
    const answerMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'user',
      messageKind: 'user_input',
      content: 'Keep going.',
      sequenceNumber: 1,
      status: 'completed',
    });
    const processingMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'planner_status',
      content: 'Analyzing the clarified request.',
      sequenceNumber: 2,
      status: 'pending',
      metadata: {
        stage: 'analyzing',
        userMessageId: answerMessage.id,
      },
    });
    const run = await createPlanningRunRecord({
      sessionId: session.id,
      triggerMessageId: answerMessage.id,
      statusMessageId: processingMessage.id,
    });

    const detail = (await processQueuedPlanningRun(run.id))!;

    expect(detail.session.planner_state).toBe('clarifying');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'clarifying',
        state: 'waiting_for_clarification',
      })
    );
    expect(detail.messages.find((message) => message.id === processingMessage.id)).toEqual(
      expect.objectContaining({
        message_kind: 'clarification_questions',
        status: 'completed',
      })
    );
    expect(detail.questions.at(-1)).toEqual(
      expect.objectContaining({
        question_key: 'first-release-boundary',
        status: 'open',
      })
    );
  });

  it('accepts answers for the matching open clarification batch and supersedes other stale open batches', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'clarifying',
    });
    const olderClarificationMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'clarification_questions',
      content: 'I need one clarification.',
      sequenceNumber: 1,
      status: 'completed',
    });
    const newerClarificationMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'clarification_questions',
      content: 'I need one newer clarification.',
      sequenceNumber: 2,
      status: 'completed',
    });

    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'older-scope-choice',
      questionText: 'Which scope should planning mode cover first?',
      askedInMessageId: olderClarificationMessage.id,
      options: [
        {
          optionKey: 'workspace',
          label: 'Workspace',
          description: 'Keep the rollout in the AI workspace.',
        },
        {
          optionKey: 'board',
          label: 'Board',
          description: 'Move planning into the board view.',
        },
        {
          optionKey: 'new-screen',
          label: 'New screen',
          description: 'Create a separate planning screen.',
        },
      ],
    });
    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'newer-hosting-target',
      questionText: 'Where should the planning service run?',
      askedInMessageId: newerClarificationMessage.id,
      options: [
        {
          optionKey: 'docker',
          label: 'Docker',
          description: 'Run it in Docker.',
        },
        {
          optionKey: 'kubernetes',
          label: 'Kubernetes',
          description: 'Run it in Kubernetes.',
        },
        {
          optionKey: 'vm',
          label: 'VM',
          description: 'Run it on a VM.',
        },
      ],
    });

    const pendingReply = await createOrganizationAiPlanningSessionMessage({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionId: session.id,
      sessionUserId: owner.id,
      data: {
        mode: 'clarification_batch',
        answers: [
          {
            questionKey: 'older-scope-choice',
            selectedOptionKey: 'workspace',
          },
        ],
      },
    });

    const olderQuestion = pendingReply.questions.find(
      (question) => question.question_key === 'older-scope-choice'
    );
    const newerQuestion = pendingReply.questions.find(
      (question) => question.question_key === 'newer-hosting-target'
    );

    expect(olderQuestion).toEqual(
      expect.objectContaining({
        status: 'answered',
        selected_option_key: 'workspace',
      })
    );
    expect(newerQuestion).toEqual(
      expect.objectContaining({
        status: 'superseded',
      })
    );
  });

  it('requeues the latest persisted run without executing it inline', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const pendingDetail = await createOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionUserId: owner.id,
      data: {
        content: 'Plan the next phase of the AI workspace.',
      },
    });

    const detail = await processOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionId: pendingDetail.session.id,
      sessionUserId: owner.id,
    });

    expect(detail.session.planner_state).toBe('queued');
    expect(detail.activeRun).toEqual(
      expect.objectContaining({
        attempt_count: 0,
        stage: 'queued',
        state: 'queued',
      })
    );
    expect(detail.messages.at(-1)).toEqual(
      expect.objectContaining({
        message_kind: 'planner_status',
        content: 'Queued the planning run and waiting for the executor to start...',
        status: 'pending',
        metadata_json: expect.objectContaining({
          retryable: true,
          stage: 'queued',
        }),
      })
    );
    expect(mockedAnalyzePlanningTurn).not.toHaveBeenCalled();
  });

  it('marks the session failed when planner processing throws and keeps the turn retryable', async () => {
    mockedAnalyzePlanningTurn.mockRejectedValue(
      new Error('Local AI request failed: invalid JSON')
    );

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const pendingDetail = await createOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionUserId: owner.id,
      data: {
        content: 'Plan the next phase of the AI workspace.',
      },
    });

    await expect(
      processQueuedPlanningRun(pendingDetail.activeRun!.id)
    ).rejects.toThrow('Local AI request failed: invalid JSON');

    const failedDetail = await getOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionId: pendingDetail.session.id,
      sessionUserId: owner.id,
    });

    expect(failedDetail.session.planner_state).toBe('failed');
    expect(failedDetail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'failed',
        state: 'failed',
      })
    );
    expect(failedDetail.messages.at(-1)).toEqual(
      expect.objectContaining({
        message_kind: 'planner_status',
        status: 'failed',
        content: 'Local AI request failed: invalid JSON',
      })
    );
  });

  it('persists structured validation diagnostics when analysis schema validation fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockedAnalyzePlanningTurn.mockRejectedValue(
      new StructuredAiResponseError('Failed to analyze the planning session', {
        failureCode: 'schema_validation_failed',
        responseExcerpt: '{"recommendedNextAction":"clarify"}',
        validationIssues: [
          'knownRequirements.0: String must contain at most 240 character(s)',
        ],
      })
    );

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const pendingDetail = await createOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionUserId: owner.id,
      data: {
        content: 'Plan the next phase of the AI workspace.',
      },
    });

    await expect(
      processQueuedPlanningRun(pendingDetail.activeRun!.id)
    ).rejects.toThrow('Failed to analyze the planning session');

    const failedDetail = await getOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionId: pendingDetail.session.id,
      sessionUserId: owner.id,
    });

    expect(failedDetail.activeRun).toEqual(
      expect.objectContaining({
        error_message: 'Failed to analyze the planning session',
        metadata_json: expect.objectContaining({
          failureCode: 'schema_validation_failed',
          responseExcerpt: '{"recommendedNextAction":"clarify"}',
          validationIssues: [
            'knownRequirements.0: String must contain at most 240 character(s)',
          ],
        }),
      })
    );
    expect(failedDetail.messages.at(-1)).toEqual(
      expect.objectContaining({
        message_kind: 'planner_status',
        status: 'failed',
        metadata_json: expect.objectContaining({
          failureCode: 'schema_validation_failed',
          responseExcerpt: '{"recommendedNextAction":"clarify"}',
          validationIssues: [
            'knownRequirements.0: String must contain at most 240 character(s)',
          ],
        }),
      })
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[PLANNING_FAILURE]',
      expect.objectContaining({
        errorMessage: 'Failed to analyze the planning session',
        failureCode: 'schema_validation_failed',
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it('fails planning processing when the local runtime cannot verify GPU acceleration', async () => {
    mockedEnsureLocalOllamaPlanningReady.mockRejectedValue(
      new Error(
        'Planning requires GPU-backed Ollama, but the local planning model is currently running on CPU'
      )
    );

    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addBoardMember(Number(board.id), owner.id);

    const pendingDetail = await createOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionUserId: owner.id,
      data: {
        content: 'Plan the next phase of the AI workspace.',
      },
    });

    await expect(
      processQueuedPlanningRun(pendingDetail.activeRun!.id)
    ).rejects.toThrow(
      'Planning requires GPU-backed Ollama, but the local planning model is currently running on CPU'
    );

    const failedDetail = await getOrganizationAiPlanningSession({
      organizationId: organization.id,
      boardId: Number(board.id),
      sessionId: pendingDetail.session.id,
      sessionUserId: owner.id,
    });

    expect(failedDetail.session.planner_state).toBe('failed');
    expect(failedDetail.activeRun).toEqual(
      expect.objectContaining({
        stage: 'failed',
        state: 'failed',
      })
    );
    expect(failedDetail.messages.at(-1)?.content).toBe(
      'Planning requires GPU-backed Ollama, but the local planning model is currently running on CPU'
    );
  });

  it('blocks other board members from opening a creator-owned planning session', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const teammate = await createUser({ email: 'teammate@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    await addOrganizationMember(organization.id, teammate.id);
    await addBoardMember(Number(board.id), owner.id);
    await addBoardMember(Number(board.id), teammate.id);

    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
    });

    await expect(
      getOrganizationAiPlanningSession({
        organizationId: organization.id,
        boardId: Number(board.id),
        sessionId: session.id,
        sessionUserId: teammate.id,
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<ForbiddenError>>({
        message: 'You do not have access to this planning session',
      })
    );
  });
});

// Verifies the board-scoped planning routes enforce auth wiring for create, read, reply, and process actions.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  mockedListOrganizationAiPlanningSessions,
  mockedCreateOrganizationAiPlanningSession,
  mockedGetOrganizationAiPlanningSession,
  mockedCreateOrganizationAiPlanningSessionMessage,
  mockedProcessOrganizationAiPlanningSession,
  mockedRequireSession,
  mockedRequireOrganizationBoardMember,
  mockedHandleApiError,
} = vi.hoisted(() => ({
  mockedListOrganizationAiPlanningSessions: vi.fn(),
  mockedCreateOrganizationAiPlanningSession: vi.fn(),
  mockedGetOrganizationAiPlanningSession: vi.fn(),
  mockedCreateOrganizationAiPlanningSessionMessage: vi.fn(),
  mockedProcessOrganizationAiPlanningSession: vi.fn(),
  mockedRequireSession: vi.fn(),
  mockedRequireOrganizationBoardMember: vi.fn(),
  mockedHandleApiError: vi.fn(),
}));

vi.mock('@/lib/controllers/ai/organizationAiPlanningControllers', () => ({
  listOrganizationAiPlanningSessions: mockedListOrganizationAiPlanningSessions,
  createOrganizationAiPlanningSession: mockedCreateOrganizationAiPlanningSession,
  getOrganizationAiPlanningSession: mockedGetOrganizationAiPlanningSession,
  createOrganizationAiPlanningSessionMessage:
    mockedCreateOrganizationAiPlanningSessionMessage,
  processOrganizationAiPlanningSession: mockedProcessOrganizationAiPlanningSession,
}));

vi.mock('@/lib/utils/auth', () => ({
  requireSession: mockedRequireSession,
}));

vi.mock('@/lib/utils/organizationBoardRoute', () => ({
  requireOrganizationBoardMember: mockedRequireOrganizationBoardMember,
}));

vi.mock('@/lib/utils/apiErrors', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/apiErrors')>(
    '@/lib/utils/apiErrors'
  );

  return {
    ...actual,
    handleApiError: mockedHandleApiError,
  };
});

import { GET as getPlanningSessions, POST as postPlanningSession } from '@/app/api/organizations/[organizationId]/boards/[boardId]/ai/planning/sessions/route';
import { GET as getPlanningSession } from '@/app/api/organizations/[organizationId]/boards/[boardId]/ai/planning/sessions/[sessionId]/route';
import { POST as postPlanningSessionMessage } from '@/app/api/organizations/[organizationId]/boards/[boardId]/ai/planning/sessions/[sessionId]/messages/route';
import { POST as postPlanningSessionProcess } from '@/app/api/organizations/[organizationId]/boards/[boardId]/ai/planning/sessions/[sessionId]/process/route';

describe('organization AI planning routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireSession.mockResolvedValue({ userId: 21 });
    mockedRequireOrganizationBoardMember.mockResolvedValue({
      organizationId: 3,
      boardId: 7,
    });
    mockedHandleApiError.mockImplementation((error: unknown) =>
      NextResponse.json({ error: String(error) }, { status: 500 })
    );
  });

  it('lists planning sessions for the authenticated board member', async () => {
    mockedListOrganizationAiPlanningSessions.mockResolvedValue([
      {
        id: 9,
        organization_id: 3,
        board_id: 7,
        created_by: 21,
        title: 'Planner workspace polish',
        summary: 'Plan the board planning workspace.',
        original_prompt: 'Plan the workspace',
        planner_state: 'clarifying',
        clarification_turn_count: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const response = await getPlanningSessions(
      {} as never,
      {
        params: Promise.resolve({ organizationId: '3', boardId: '7' }),
      }
    );

    expect(mockedListOrganizationAiPlanningSessions).toHaveBeenCalledWith({
      organizationId: 3,
      boardId: 7,
      sessionUserId: 21,
    });
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: 9, board_id: 7 }),
    ]);
  });

  it('creates a planning session for the selected board', async () => {
    mockedCreateOrganizationAiPlanningSession.mockResolvedValue({
      session: {
        id: 9,
        organization_id: 3,
        board_id: 7,
        created_by: 21,
        title: 'Planner workspace polish',
        summary: 'Plan the board planning workspace.',
        original_prompt: 'Plan the workspace',
        planner_state: 'analyzing',
        clarification_turn_count: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      messages: [],
      questions: [],
      context: {
        objective: null,
      },
      readiness: {
        objectiveClear: false,
      },
      planArtifact: null,
    });

    const response = await postPlanningSession(
      {
        json: async () => ({
          content: 'Plan the workspace',
        }),
      } as never,
      {
        params: Promise.resolve({ organizationId: '3', boardId: '7' }),
      }
    );

    expect(mockedCreateOrganizationAiPlanningSession).toHaveBeenCalledWith({
      organizationId: 3,
      boardId: 7,
      sessionUserId: 21,
      data: {
        content: 'Plan the workspace',
      },
    });
    expect(response.status).toBe(200);
  });

  it('returns one planning session detail payload', async () => {
    mockedGetOrganizationAiPlanningSession.mockResolvedValue({
      session: {
        id: 9,
        organization_id: 3,
        board_id: 7,
        created_by: 21,
        title: 'Planner workspace polish',
        summary: 'Plan the board planning workspace.',
        original_prompt: 'Plan the workspace',
        planner_state: 'clarifying',
        clarification_turn_count: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      messages: [],
      questions: [],
      context: {
        objective: 'Ship planning mode',
      },
      readiness: {
        objectiveClear: true,
      },
      planArtifact: null,
    });

    const response = await getPlanningSession(
      {} as never,
      {
        params: Promise.resolve({
          organizationId: '3',
          boardId: '7',
          sessionId: '9',
        }),
      }
    );

    expect(mockedGetOrganizationAiPlanningSession).toHaveBeenCalledWith({
      organizationId: 3,
      boardId: 7,
      sessionId: 9,
      sessionUserId: 21,
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        session: expect.objectContaining({ id: 9 }),
      })
    );
  });

  it('appends a reply to an existing planning session', async () => {
    mockedCreateOrganizationAiPlanningSessionMessage.mockResolvedValue({
      session: {
        id: 9,
        organization_id: 3,
        board_id: 7,
        created_by: 21,
        title: 'Planner workspace polish',
        summary: 'Plan the board planning workspace.',
        original_prompt: 'Plan the workspace',
        planner_state: 'analyzing',
        clarification_turn_count: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      messages: [],
      questions: [],
      context: {
        objective: 'Ship planning mode',
      },
      readiness: {
        objectiveClear: true,
      },
      planArtifact: null,
    });

    const response = await postPlanningSessionMessage(
      {
        json: async () => ({
          mode: 'freeform',
          content: 'Keep the assistant as a separate mode.',
        }),
      } as never,
      {
        params: Promise.resolve({
          organizationId: '3',
          boardId: '7',
          sessionId: '9',
        }),
      }
    );

    expect(mockedCreateOrganizationAiPlanningSessionMessage).toHaveBeenCalledWith({
      organizationId: 3,
      boardId: 7,
      sessionId: 9,
      sessionUserId: 21,
      data: {
        mode: 'freeform',
        content: 'Keep the assistant as a separate mode.',
      },
    });
    expect(response.status).toBe(200);
  });

  it('processes the latest persisted planning turn', async () => {
    mockedProcessOrganizationAiPlanningSession.mockResolvedValue({
      session: {
        id: 9,
        organization_id: 3,
        board_id: 7,
        created_by: 21,
        title: 'Planner workspace polish',
        summary: 'Plan the board planning workspace.',
        original_prompt: 'Plan the workspace',
        planner_state: 'plan_generated',
        clarification_turn_count: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      messages: [],
      questions: [],
      context: {
        objective: 'Ship planning mode',
      },
      readiness: {
        objectiveClear: true,
      },
      planArtifact: {
        summary: 'Done',
      },
    });

    const response = await postPlanningSessionProcess(
      {} as never,
      {
        params: Promise.resolve({
          organizationId: '3',
          boardId: '7',
          sessionId: '9',
        }),
      }
    );

    expect(mockedProcessOrganizationAiPlanningSession).toHaveBeenCalledWith({
      organizationId: 3,
      boardId: 7,
      sessionId: 9,
      sessionUserId: 21,
    });
    expect(response.status).toBe(200);
  });
});

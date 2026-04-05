import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  mockedAddBoardMembers,
  mockedGetBoardMembers,
  mockedSearchBoardInviteCandidates,
  mockedRequireOrganizationBoardCreator,
  mockedRequireOrganizationBoardMember,
  mockedRequireSession,
  mockedHandleApiError,
} = vi.hoisted(() => ({
  mockedAddBoardMembers: vi.fn(),
  mockedGetBoardMembers: vi.fn(),
  mockedSearchBoardInviteCandidates: vi.fn(),
  mockedRequireOrganizationBoardCreator: vi.fn(),
  mockedRequireOrganizationBoardMember: vi.fn(),
  mockedRequireSession: vi.fn(),
  mockedHandleApiError: vi.fn(),
}));

vi.mock('@/lib/controllers/boardMembers/boardMemberControllers', () => ({
  addBoardMembers: mockedAddBoardMembers,
  getBoardMembers: mockedGetBoardMembers,
  searchBoardInviteCandidates: mockedSearchBoardInviteCandidates,
}));

vi.mock('@/lib/utils/auth', () => ({
  requireSession: mockedRequireSession,
}));

vi.mock('@/lib/utils/organizationBoardRoute', () => ({
  requireOrganizationBoardCreator: mockedRequireOrganizationBoardCreator,
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

import { GET, POST } from '@/app/api/organizations/[organizationId]/boards/[boardId]/member/route';
import { GET as getCandidates } from '@/app/api/organizations/[organizationId]/boards/[boardId]/member-candidates/route';

describe('board member route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireSession.mockResolvedValue({ userId: 17 });
    mockedRequireOrganizationBoardMember.mockResolvedValue({
      organizationId: 3,
      boardId: 9,
    });
    mockedRequireOrganizationBoardCreator.mockResolvedValue({
      organizationId: 3,
      boardId: 9,
    });
    mockedHandleApiError.mockImplementation((error: unknown) =>
      NextResponse.json({ error: String(error) }, { status: 500 })
    );
  });

  it('lists board members', async () => {
    mockedGetBoardMembers.mockResolvedValue([]);

    const response = await GET({} as never, {
      params: Promise.resolve({ organizationId: '3', boardId: '9' }),
    });

    expect(mockedGetBoardMembers).toHaveBeenCalledWith({
      boardId: 9,
      sessionUserId: 17,
    });
    expect(response.status).toBe(200);
  });

  it('adds board members from POST', async () => {
    mockedAddBoardMembers.mockResolvedValue({ addedCount: 1 });

    const response = await POST(
      {
        json: async () => ({
          userIds: [8],
        }),
      } as never,
      {
        params: Promise.resolve({ organizationId: '3', boardId: '9' }),
      }
    );

    expect(mockedAddBoardMembers).toHaveBeenCalledWith({
      boardId: 9,
      sessionUserId: 17,
      data: {
        userIds: [8],
      },
    });
    expect(response.status).toBe(200);
  });

  it('searches board invite candidates', async () => {
    mockedSearchBoardInviteCandidates.mockResolvedValue([]);

    const response = await getCandidates(
      {
        nextUrl: {
          searchParams: new URLSearchParams({ query: 'alex' }),
        },
      } as never,
      {
        params: Promise.resolve({ organizationId: '3', boardId: '9' }),
      }
    );

    expect(mockedSearchBoardInviteCandidates).toHaveBeenCalledWith({
      organizationId: 3,
      boardId: 9,
      sessionUserId: 17,
      query: 'alex',
    });
    expect(response.status).toBe(200);
  });
});

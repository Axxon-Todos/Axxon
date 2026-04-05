import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  mockedGetBoardRepositories,
  mockedReplaceBoardRepositories,
  mockedGetOrganizationBoardRepositoryAccess,
  mockedRequireSession,
  mockedHandleApiError,
} = vi.hoisted(() => ({
  mockedGetBoardRepositories: vi.fn(),
  mockedReplaceBoardRepositories: vi.fn(),
  mockedGetOrganizationBoardRepositoryAccess: vi.fn(),
  mockedRequireSession: vi.fn(),
  mockedHandleApiError: vi.fn(),
}));

vi.mock('@/lib/controllers/boardRepositoryAccess/boardRepositoryAccessControllers', () => ({
  getBoardRepositories: mockedGetBoardRepositories,
  replaceBoardRepositories: mockedReplaceBoardRepositories,
  getOrganizationBoardRepositoryAccess: mockedGetOrganizationBoardRepositoryAccess,
}));

vi.mock('@/lib/utils/auth', () => ({
  requireSession: mockedRequireSession,
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

import { GET as getBoardRepositoriesRoute, PUT as putBoardRepositoriesRoute } from '@/app/api/organizations/[organizationId]/boards/[boardId]/repositories/route';
import { GET as getOrganizationBoardRepositoryAccessRoute } from '@/app/api/organizations/[organizationId]/board-repository-access/route';

describe('board repository routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireSession.mockResolvedValue({ userId: 17 });
    mockedHandleApiError.mockImplementation((error: unknown) =>
      NextResponse.json({ error: String(error) }, { status: 500 })
    );
  });

  it('lists repositories linked to a board', async () => {
    mockedGetBoardRepositories.mockResolvedValue({ repositories: [] });

    const response = await getBoardRepositoriesRoute({} as never, {
      params: Promise.resolve({ organizationId: '3', boardId: '9' }),
    });

    expect(mockedGetBoardRepositories).toHaveBeenCalledWith({
      organizationId: 3,
      boardId: 9,
      sessionUserId: 17,
    });
    expect(response.status).toBe(200);
  });

  it('replaces repository access for a board', async () => {
    mockedReplaceBoardRepositories.mockResolvedValue({ repositories: [] });

    const response = await putBoardRepositoriesRoute(
      {
        json: async () => ({
          repositoryIds: [1, 2],
        }),
      } as never,
      {
        params: Promise.resolve({ organizationId: '3', boardId: '9' }),
      }
    );

    expect(mockedReplaceBoardRepositories).toHaveBeenCalledWith({
      organizationId: 3,
      boardId: 9,
      sessionUserId: 17,
      data: {
        repositoryIds: [1, 2],
      },
    });
    expect(response.status).toBe(200);
  });

  it('returns the org-wide board repository overview', async () => {
    mockedGetOrganizationBoardRepositoryAccess.mockResolvedValue({
      boards: [],
      repositories: [],
      links: [],
    });

    const response = await getOrganizationBoardRepositoryAccessRoute({} as never, {
      params: Promise.resolve({ organizationId: '3' }),
    });

    expect(mockedGetOrganizationBoardRepositoryAccess).toHaveBeenCalledWith({
      organizationId: 3,
      sessionUserId: 17,
    });
    expect(response.status).toBe(200);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  mockedGetOrganizationMembers,
  mockedInviteOrganizationMembers,
  mockedSearchOrganizationInviteCandidates,
  mockedRequireSession,
  mockedHandleApiError,
} = vi.hoisted(() => ({
  mockedGetOrganizationMembers: vi.fn(),
  mockedInviteOrganizationMembers: vi.fn(),
  mockedSearchOrganizationInviteCandidates: vi.fn(),
  mockedRequireSession: vi.fn(),
  mockedHandleApiError: vi.fn(),
}));

vi.mock('@/lib/controllers/organizations/organizationControllers', () => ({
  getOrganizationMembers: mockedGetOrganizationMembers,
  inviteOrganizationMembers: mockedInviteOrganizationMembers,
  searchOrganizationInviteCandidates: mockedSearchOrganizationInviteCandidates,
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

import { GET, POST } from '@/app/api/organizations/[organizationId]/members/route';
import { GET as getCandidates } from '@/app/api/organizations/[organizationId]/member-candidates/route';

describe('organization members route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireSession.mockResolvedValue({ userId: 17 });
    mockedHandleApiError.mockImplementation((error: unknown) =>
      NextResponse.json({ error: String(error) }, { status: 500 })
    );
  });

  it('lists organization members', async () => {
    mockedGetOrganizationMembers.mockResolvedValue([]);

    const response = await GET({} as never, {
      params: Promise.resolve({ organizationId: '3' }),
    });

    expect(mockedGetOrganizationMembers).toHaveBeenCalledWith({
      organizationId: 3,
      sessionUserId: 17,
    });
    expect(response.status).toBe(200);
  });

  it('invites organization members from POST', async () => {
    mockedInviteOrganizationMembers.mockResolvedValue({
      addedCount: 1,
      alreadyMemberEmails: [],
    });

    const response = await POST(
      {
        json: async () => ({
          userIds: [18],
        }),
      } as never,
      {
        params: Promise.resolve({ organizationId: '3' }),
      }
    );

    expect(mockedInviteOrganizationMembers).toHaveBeenCalledWith({
      organizationId: 3,
      sessionUserId: 17,
      data: {
        userIds: [18],
      },
    });
    expect(response.status).toBe(200);
  });

  it('searches organization member candidates', async () => {
    mockedSearchOrganizationInviteCandidates.mockResolvedValue([]);

    const response = await getCandidates(
      {
        nextUrl: {
          searchParams: new URLSearchParams({ query: 'alex' }),
        },
      } as never,
      {
        params: Promise.resolve({ organizationId: '3' }),
      }
    );

    expect(mockedSearchOrganizationInviteCandidates).toHaveBeenCalledWith({
      organizationId: 3,
      sessionUserId: 17,
      query: 'alex',
    });
    expect(response.status).toBe(200);
  });
});

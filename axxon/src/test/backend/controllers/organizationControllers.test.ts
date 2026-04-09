// Covers organization controller normalization, authorization, and brand-default color behavior.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError } from '@/lib/utils/apiErrors';
import { DEFAULT_BRAND_PRIMARY_HEX } from '@/lib/utils/brandColors';

const {
  mockedCreateBoard,
  mockedCreateOrganizationModel,
  mockedGetSummaryById,
  mockedAddOrganizationMembers,
  mockedListOrganizationInviteCandidates,
  mockedListMembershipsForUserIds,
  mockedUpdateOrganizationModel,
  mockedListUsersByIds,
  mockedRequireOrganizationMember,
  mockedRequireOrganizationOwner,
} = vi.hoisted(() => ({
  mockedCreateBoard: vi.fn(),
  mockedCreateOrganizationModel: vi.fn(),
  mockedGetSummaryById: vi.fn(),
  mockedAddOrganizationMembers: vi.fn(),
  mockedListOrganizationInviteCandidates: vi.fn(),
  mockedListMembershipsForUserIds: vi.fn(),
  mockedUpdateOrganizationModel: vi.fn(),
  mockedListUsersByIds: vi.fn(),
  mockedRequireOrganizationMember: vi.fn(),
  mockedRequireOrganizationOwner: vi.fn(),
}));

vi.mock('@/lib/models/board', () => ({
  Board: {
    createBoard: mockedCreateBoard,
  },
}));

vi.mock('@/lib/models/boardMembers', () => ({
  BoardMembers: {},
}));

vi.mock('@/lib/models/organizationMembers', () => ({
  OrganizationMembers: {
    addMembers: mockedAddOrganizationMembers,
    listInviteCandidates: mockedListOrganizationInviteCandidates,
    listMembershipsForUserIds: mockedListMembershipsForUserIds,
  },
}));

vi.mock('@/lib/models/organizations', () => ({
  Organizations: {
    createOrganization: mockedCreateOrganizationModel,
    getSummaryById: mockedGetSummaryById,
    updateOrganization: mockedUpdateOrganizationModel,
  },
}));

vi.mock('@/lib/models/users', () => ({
  Users: {
    listUsersByIds: mockedListUsersByIds,
  },
}));

vi.mock('@/lib/utils/authorization', () => ({
  requireOrganizationMember: mockedRequireOrganizationMember,
  requireOrganizationOwner: mockedRequireOrganizationOwner,
}));

import {
  createOrganization,
  createOrganizationBoard,
  inviteOrganizationMembers,
  searchOrganizationInviteCandidates,
  updateOrganization,
} from '@/lib/controllers/organizations/organizationControllers';

describe('organizationControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireOrganizationMember.mockResolvedValue({ id: 3 });
    mockedRequireOrganizationOwner.mockResolvedValue({ id: 3 });
    mockedCreateBoard.mockResolvedValue({
      id: 9,
      organization_id: 3,
      created_by: 7,
      name: 'Delivery Board',
      color: DEFAULT_BRAND_PRIMARY_HEX,
    });
    mockedCreateOrganizationModel.mockResolvedValue({
      id: 3,
      name: 'Platform',
      description: null,
      color: DEFAULT_BRAND_PRIMARY_HEX,
    });
    mockedUpdateOrganizationModel.mockResolvedValue({
      id: 3,
      name: 'Platform',
      description: null,
      color: null,
    });
    mockedGetSummaryById.mockResolvedValue({
      id: 3,
      name: 'Platform',
      description: null,
      color: null,
      created_by: 7,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      member_count: 2,
      accessible_board_count: 4,
      repo_count: 0,
    });
    mockedListUsersByIds.mockResolvedValue([
      {
        id: 8,
        email: 'member@example.com',
      },
    ]);
    mockedListMembershipsForUserIds.mockResolvedValue([]);
    mockedAddOrganizationMembers.mockResolvedValue(1);
    mockedListOrganizationInviteCandidates.mockResolvedValue([]);
  });

  it('defaults new organizations to the shared brand primary color', async () => {
    await createOrganization({
      sessionUserId: 7,
      data: {
        name: '  Platform  ',
        description: '  Org shell  ',
        color: '   ',
      },
    });

    expect(mockedCreateOrganizationModel).toHaveBeenCalledWith({
      created_by: 7,
      name: 'Platform',
      description: 'Org shell',
      color: DEFAULT_BRAND_PRIMARY_HEX,
    });
  });

  it('defaults new org boards to the shared brand primary color', async () => {
    await createOrganizationBoard({
      organizationId: 3,
      sessionUserId: 7,
      data: {
        name: '  Delivery Board  ',
      },
    });

    expect(mockedRequireOrganizationMember).toHaveBeenCalledWith(3, 7);
    expect(mockedCreateBoard).toHaveBeenCalledWith({
      organization_id: 3,
      created_by: 7,
      name: 'Delivery Board',
      color: DEFAULT_BRAND_PRIMARY_HEX,
      member_emails: [],
    });
  });

  it('normalizes updates before saving and returns the refreshed summary', async () => {
    const organization = await updateOrganization({
      organizationId: 3,
      sessionUserId: 7,
      data: {
        name: '  Platform  ',
        description: '   ',
        color: '   ',
      },
    });

    expect(mockedRequireOrganizationOwner).toHaveBeenCalledWith(3, 7);
    expect(mockedUpdateOrganizationModel).toHaveBeenCalledWith(3, {
      name: 'Platform',
      description: null,
      color: null,
    });
    expect(organization).toMatchObject({
      id: 3,
      name: 'Platform',
      member_count: 2,
    });
  });

  it('propagates owner-only authorization failures', async () => {
    const error = new ForbiddenError('Only organization owners can perform this action');
    mockedRequireOrganizationOwner.mockRejectedValue(error);

    await expect(
      updateOrganization({
        organizationId: 3,
        sessionUserId: 8,
        data: { name: 'Restricted' },
      })
    ).rejects.toBe(error);

    expect(mockedUpdateOrganizationModel).not.toHaveBeenCalled();
  });

  it('invites existing users into the organization and reports already-added emails', async () => {
    mockedListUsersByIds.mockResolvedValue([
      {
        id: 8,
        email: 'member@example.com',
      },
      {
        id: 9,
        email: 'existing@example.com',
      },
    ]);
    mockedListMembershipsForUserIds.mockResolvedValue([{ user_id: 9 }]);
    mockedAddOrganizationMembers.mockResolvedValue(1);

    const response = await inviteOrganizationMembers({
      organizationId: 3,
      sessionUserId: 7,
      data: {
        userIds: [8, 9],
      },
    });

    expect(mockedRequireOrganizationOwner).toHaveBeenCalledWith(3, 7);
    expect(mockedAddOrganizationMembers).toHaveBeenCalledWith(3, [8, 9]);
    expect(response).toEqual({
      addedCount: 1,
      alreadyMemberEmails: ['existing@example.com'],
    });
  });

  it('rejects invites for unknown users', async () => {
    mockedListUsersByIds.mockResolvedValue([]);

    await expect(
      inviteOrganizationMembers({
        organizationId: 3,
        sessionUserId: 7,
        data: {
          userIds: [44],
        },
      })
    ).rejects.toThrow('These users do not exist: 44');

    expect(mockedAddOrganizationMembers).not.toHaveBeenCalled();
  });

  it('searches invite candidates for organization owners', async () => {
    mockedListOrganizationInviteCandidates.mockResolvedValue([
      { id: 12, email: 'alex@example.com' },
    ]);

    const response = await searchOrganizationInviteCandidates({
      organizationId: 3,
      sessionUserId: 7,
      query: 'alex',
    });

    expect(mockedRequireOrganizationOwner).toHaveBeenCalledWith(3, 7);
    expect(mockedListOrganizationInviteCandidates).toHaveBeenCalledWith(3, 'alex');
    expect(response).toEqual([{ id: 12, email: 'alex@example.com' }]);
  });
});

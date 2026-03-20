import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError } from '@/lib/utils/apiErrors';

const {
  mockedGetSummaryById,
  mockedUpdateOrganizationModel,
  mockedRequireOrganizationOwner,
} = vi.hoisted(() => ({
  mockedGetSummaryById: vi.fn(),
  mockedUpdateOrganizationModel: vi.fn(),
  mockedRequireOrganizationOwner: vi.fn(),
}));

vi.mock('@/lib/models/board', () => ({
  Board: {},
}));

vi.mock('@/lib/models/boardMembers', () => ({
  BoardMembers: {},
}));

vi.mock('@/lib/models/organizationMembers', () => ({
  OrganizationMembers: {},
}));

vi.mock('@/lib/models/organizations', () => ({
  Organizations: {
    getSummaryById: mockedGetSummaryById,
    updateOrganization: mockedUpdateOrganizationModel,
  },
}));

vi.mock('@/lib/utils/authorization', () => ({
  requireOrganizationMember: vi.fn(),
  requireOrganizationOwner: mockedRequireOrganizationOwner,
}));

import { updateOrganization } from '@/lib/controllers/organizations/organizationControllers';

describe('organizationControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireOrganizationOwner.mockResolvedValue({ id: 3 });
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
});

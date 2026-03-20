import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, NotFoundError } from '@/lib/utils/apiErrors';

const {
  mockedGetBoardById,
  mockedIsMember,
  mockedGetOrganizationById,
  mockedIsOrganizationMember,
  mockedGetOrganizationRole,
} = vi.hoisted(() => ({
  mockedGetBoardById: vi.fn(),
  mockedIsMember: vi.fn(),
  mockedGetOrganizationById: vi.fn(),
  mockedIsOrganizationMember: vi.fn(),
  mockedGetOrganizationRole: vi.fn(),
}));

vi.mock('@/lib/models/board', () => ({
  Board: {
    getBoardById: mockedGetBoardById,
  },
}));

vi.mock('@/lib/models/boardMembers', () => ({
  BoardMembers: {
    isMember: mockedIsMember,
  },
}));

vi.mock('@/lib/models/organizations', () => ({
  Organizations: {
    getById: mockedGetOrganizationById,
  },
}));

vi.mock('@/lib/models/organizationMembers', () => ({
  OrganizationMembers: {
    isMember: mockedIsOrganizationMember,
    getRole: mockedGetOrganizationRole,
  },
}));

import {
  requireOrganizationMember,
  requireOrganizationOwner,
  requireBoardCreator,
  requireBoardMember,
  requireSameUser,
} from '@/lib/utils/authorization';

describe('authorization utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetOrganizationById.mockResolvedValue({ id: 3, created_by: 10 });
    mockedIsOrganizationMember.mockResolvedValue(true);
    mockedGetOrganizationRole.mockResolvedValue('owner');
  });

  it('enforces same-user access', () => {
    expect(() => requireSameUser(1, 2)).toThrow(ForbiddenError);
  });

  it('throws when a board does not exist', async () => {
    mockedGetBoardById.mockResolvedValue(null);

    await expect(requireBoardMember(1, 2)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws when a board member check fails', async () => {
    mockedGetBoardById.mockResolvedValue({ id: 1, created_by: 99, organization_id: 3 });
    mockedIsMember.mockResolvedValue(false);

    await expect(requireBoardMember(1, 2)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws when a non-creator attempts a creator-only action', async () => {
    mockedGetBoardById.mockResolvedValue({ id: 1, created_by: 77, organization_id: 3 });

    await expect(requireBoardCreator(1, 2)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws when an organization does not exist', async () => {
    mockedGetOrganizationById.mockResolvedValue(null);

    await expect(requireOrganizationMember(4, 2)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws when a user is not an organization member', async () => {
    mockedIsOrganizationMember.mockResolvedValue(false);

    await expect(requireOrganizationMember(4, 2)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws when a non-owner attempts an owner-only organization action', async () => {
    mockedGetOrganizationRole.mockResolvedValue('member');

    await expect(requireOrganizationOwner(4, 2)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BadRequestError } from '@/lib/utils/apiErrors';

const {
  mockedAddMembersByUserIds,
  mockedListMembershipsForUserIds,
  mockedRemoveMember,
  mockedRequireBoardCreator,
  mockedRequireBoardMember,
  mockedRequireSameUser,
} = vi.hoisted(() => ({
  mockedAddMembersByUserIds: vi.fn(),
  mockedListMembershipsForUserIds: vi.fn(),
  mockedRemoveMember: vi.fn(),
  mockedRequireBoardCreator: vi.fn(),
  mockedRequireBoardMember: vi.fn(),
  mockedRequireSameUser: vi.fn(),
}));

vi.mock('@/lib/models/boardMembers', () => ({
  BoardMembers: {
    addMembersByUserIds: mockedAddMembersByUserIds,
    removeMember: mockedRemoveMember,
    listBoardsForUser: vi.fn(),
    getAllMembersForBoard: vi.fn(),
    getMemberById: vi.fn(),
  },
}));

vi.mock('@/lib/models/organizationMembers', () => ({
  OrganizationMembers: {
    listMembershipsForUserIds: mockedListMembershipsForUserIds,
  },
}));

vi.mock('@/lib/utils/authorization', () => ({
  requireBoardCreator: mockedRequireBoardCreator,
  requireBoardMember: mockedRequireBoardMember,
  requireSameUser: mockedRequireSameUser,
}));

import {
  addBoardMembers,
  removeBoardMember,
} from '@/lib/controllers/boardMembers/boardMemberControllers';

describe('boardMemberControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireBoardCreator.mockResolvedValue({ id: 12, created_by: 3, organization_id: 8 });
    mockedRequireBoardMember.mockResolvedValue(undefined);
    mockedRequireSameUser.mockReturnValue(undefined);
    mockedListMembershipsForUserIds.mockResolvedValue([{ user_id: 5 }]);
  });

  it('validates that userIds is an array before calling the model', async () => {
    await expect(
      addBoardMembers({
        boardId: 12,
        sessionUserId: 3,
        data: {
          userIds: 'not-an-array',
        } as unknown as { userIds: number[] },
      })
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(mockedAddMembersByUserIds).not.toHaveBeenCalled();
  });

  it('rejects users who do not belong to the organization', async () => {
    mockedListMembershipsForUserIds.mockResolvedValue([]);

    await expect(
      addBoardMembers({
        boardId: 12,
        sessionUserId: 3,
        data: {
          userIds: [5],
        },
      })
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(mockedAddMembersByUserIds).not.toHaveBeenCalled();
  });

  it('prevents removing the board creator', async () => {
    await expect(
      removeBoardMember({
        boardId: 12,
        userId: 3,
        sessionUserId: 3,
      })
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(mockedRemoveMember).not.toHaveBeenCalled();
  });
});

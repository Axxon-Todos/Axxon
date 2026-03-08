import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BadRequestError } from '@/lib/utils/apiErrors';

const {
  mockedAddMembersByEmail,
  mockedRemoveMember,
  mockedRequireBoardCreator,
  mockedRequireBoardMember,
  mockedRequireSameUser,
} = vi.hoisted(() => ({
  mockedAddMembersByEmail: vi.fn(),
  mockedRemoveMember: vi.fn(),
  mockedRequireBoardCreator: vi.fn(),
  mockedRequireBoardMember: vi.fn(),
  mockedRequireSameUser: vi.fn(),
}));

vi.mock('@/lib/models/boardMembers', () => ({
  BoardMembers: {
    addMembersByEmail: mockedAddMembersByEmail,
    removeMember: mockedRemoveMember,
    listBoardsForUser: vi.fn(),
    getAllMembersForBoard: vi.fn(),
    getMemberById: vi.fn(),
  },
}));

vi.mock('@/lib/utils/authorization', () => ({
  requireBoardCreator: mockedRequireBoardCreator,
  requireBoardMember: mockedRequireBoardMember,
  requireSameUser: mockedRequireSameUser,
}));

import {
  addBoardMembersByEmail,
  removeBoardMember,
} from '@/lib/controllers/boardMembers/boardMemberControllers';

describe('boardMemberControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireBoardCreator.mockResolvedValue({ id: 12, created_by: 3 });
    mockedRequireBoardMember.mockResolvedValue(undefined);
    mockedRequireSameUser.mockReturnValue(undefined);
  });

  it('validates that emails is an array before calling the model', async () => {
    await expect(
      addBoardMembersByEmail({
        boardId: 12,
        sessionUserId: 3,
        data: {
          emails: 'not-an-array',
        } as unknown as { emails: string[] },
      })
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(mockedAddMembersByEmail).not.toHaveBeenCalled();
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

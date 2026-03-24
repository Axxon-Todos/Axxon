import { BoardMembers } from '@/lib/models/boardMembers';
import { OrganizationMembers } from '@/lib/models/organizationMembers';
import type { AddBoardMembers } from '@/lib/types/boardMemberTypes';
import {
  BadRequestError,
  NotFoundError,
} from '@/lib/utils/apiErrors';
import { requireBoardCreator, requireBoardMember, requireSameUser } from '@/lib/utils/authorization';

type ListBoardsForUserInput = {
  userId: number;
  sessionUserId: number;
};

type GetBoardMembersInput = {
  boardId: number;
  sessionUserId: number;
};

type GetBoardMemberByIdInput = {
  boardId: number;
  userId: number;
  sessionUserId: number;
};

type AddBoardMembersInput = {
  boardId: number;
  sessionUserId: number;
  data: {
    userIds: number[];
  };
};

type SearchBoardInviteCandidatesInput = {
  organizationId: number;
  boardId: number;
  sessionUserId: number;
  query: string;
};

type RemoveBoardMemberInput = {
  boardId: number;
  userId: number;
  sessionUserId: number;
};

// Lists all boards a user belongs to.
export async function listBoardsForUser({
  userId,
  sessionUserId,
}: ListBoardsForUserInput) {
  if (!Number.isFinite(userId)) {
    throw new BadRequestError('Invalid user id');
  }

  requireSameUser(sessionUserId, userId);

  return BoardMembers.listBoardsForUser({ user_id: userId });
}

// Lists all members in a board.
export async function getBoardMembers({ boardId, sessionUserId }: GetBoardMembersInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardMember(boardId, sessionUserId);

  return BoardMembers.getAllMembersForBoard({ board_id: boardId });
}


export async function removeBoardMember({
  boardId,
  userId,
  sessionUserId,
}: RemoveBoardMemberInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(userId)) {
    throw new BadRequestError('Invalid board or user id');
  }

  const board = await requireBoardCreator(boardId, sessionUserId);

  if (board.created_by === userId) {
    throw new BadRequestError('The board creator cannot be removed from the board');
  }

  const removal = await BoardMembers.removeMember({ user_id: userId, board_id: boardId });
  if (removal === 0) {
    throw new NotFoundError('Board member not found');
  }

  return { removed: removal };
}


export async function addBoardMembers({
  boardId,
  sessionUserId,
  data,
}: AddBoardMembersInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  const board = await requireBoardCreator(boardId, sessionUserId);

  if (!Array.isArray(data.userIds)) {
    throw new BadRequestError('userIds must be an array');
  }

  const normalizedUserIds = Array.from(
    new Set(
      data.userIds.filter((userId) => Number.isFinite(userId) && userId > 0)
    )
  );

  if (normalizedUserIds.length === 0) {
    throw new BadRequestError('At least one user id is required');
  }

  const memberships = await OrganizationMembers.listMembershipsForUserIds(
    board.organization_id,
    normalizedUserIds
  );

  if (memberships.length !== normalizedUserIds.length) {
    throw new BadRequestError('All invited users must already belong to this organization');
  }

  const input: AddBoardMembers = {
    board_id: boardId,
    user_ids: normalizedUserIds,
  };

  const addedCount = await BoardMembers.addMembersByUserIds(input);

  return { addedCount };
}

export async function searchBoardInviteCandidates({
  organizationId,
  boardId,
  sessionUserId,
  query,
}: SearchBoardInviteCandidatesInput) {
  if (!Number.isFinite(organizationId) || !Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid organization or board id');
  }

  const board = await requireBoardCreator(boardId, sessionUserId);

  if (board.organization_id !== organizationId) {
    throw new NotFoundError('Board not found');
  }

  return BoardMembers.listInviteCandidates({
    organizationId,
    boardId,
    query,
  });
}

// Gets a single board member.
export async function getBoardMemberById({
  boardId,
  userId,
  sessionUserId,
}: GetBoardMemberByIdInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(userId)) {
    throw new BadRequestError('Invalid board or user id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const member = await BoardMembers.getMemberById({ board_id: boardId, user_id: userId });
  if (!member) {
    throw new NotFoundError('Board member not found');
  }

  return member;
}

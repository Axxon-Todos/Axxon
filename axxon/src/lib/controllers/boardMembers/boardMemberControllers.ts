import { BoardMembers } from '@/lib/models/boardMembers';
import { AddBoardMembersByEmail } from '@/lib/types/boardMemberTypes';
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

type AddBoardMembersByEmailInput = {
  boardId: number;
  sessionUserId: number;
  data: {
    emails: string[];
  };
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


export async function addBoardMembersByEmail({
  boardId,
  sessionUserId,
  data,
}: AddBoardMembersByEmailInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardCreator(boardId, sessionUserId);

  if (!Array.isArray(data.emails)) {
    throw new BadRequestError('emails must be an array');
  }

  const input: AddBoardMembersByEmail = {
    board_id: boardId,
    emails: data.emails,
  };

  await BoardMembers.addMembersByEmail(input);

  return { message: 'Members added successfully' };
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

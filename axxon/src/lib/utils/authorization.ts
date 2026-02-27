import { Board } from '@/lib/models/board';
import { BoardMembers } from '@/lib/models/boardMembers';
import {
  ForbiddenError,
  NotFoundError,
} from '@/lib/utils/apiErrors';

//auth utils for session security 

export function requireSameUser(authenticatedUserId: number, requestedUserId: number) {
  if (authenticatedUserId !== requestedUserId) {
    throw new ForbiddenError('You do not have access to this user resource');
  }
}

export async function requireBoardMember(boardId: number, userId: number) {
  const board = await Board.getBoardById(boardId);

  if (!board) {
    throw new NotFoundError('Board not found');
  }

  const isMember = await BoardMembers.isMember({ board_id: boardId, user_id: userId });

  if (!isMember) {
    throw new ForbiddenError('You do not have access to this board');
  }

  return board;
}

export async function requireBoardCreator(boardId: number, userId: number) {
  const board = await Board.getBoardById(boardId);

  if (!board) {
    throw new NotFoundError('Board not found');
  }

  if (board.created_by !== userId) {
    throw new ForbiddenError('Only the board creator can perform this action');
  }

  return board;
}

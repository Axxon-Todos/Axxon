import { Board } from '@/lib/models/board';
import { BadRequestError } from '@/lib/utils/apiErrors';
import { requireSameUser } from '@/lib/utils/authorization';

type ListBoardsCreatedByUserInput = {
  userId: number;
  sessionUserId: number;
};

export async function listBoardsCreatedByUser({
  userId,
  sessionUserId,
}: ListBoardsCreatedByUserInput) {
  if (!Number.isFinite(userId)) {
    throw new BadRequestError('Invalid user id');
  }

  requireSameUser(sessionUserId, userId);

  return Board.listAllByCreator({ created_by: userId });
}

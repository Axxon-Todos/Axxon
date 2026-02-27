import { Board } from '@/lib/models/board';
import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';
import { requireBoardCreator } from '@/lib/utils/authorization';

type DeleteBoardInput = {
  boardId: number;
  sessionUserId: number;
};

export async function deleteBoard({ boardId, sessionUserId }: DeleteBoardInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardCreator(boardId, sessionUserId);

  const result = await Board.deleteBoard({ id: String(boardId) });
  if (result === 0) {
    throw new NotFoundError('Board not found');
  }

  return { deleted: result };
}

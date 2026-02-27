import { BadRequestError } from '@/lib/utils/apiErrors';
import { requireBoardMember } from '@/lib/utils/authorization';

type GetBoardByIdInput = {
  boardId: number;
  sessionUserId: number;
};

export async function getBoardById({ boardId, sessionUserId }: GetBoardByIdInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  return requireBoardMember(boardId, sessionUserId);
}

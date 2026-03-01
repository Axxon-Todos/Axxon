import { BoardAnalytics } from '@/lib/models/boardAnalytics';
import { BadRequestError } from '@/lib/utils/apiErrors';
import { requireBoardMember } from '@/lib/utils/authorization';

type GetBoardAnalyticsInput = {
  boardId: number;
  sessionUserId: number;
};

export async function getBoardAnalytics({ boardId, sessionUserId }: GetBoardAnalyticsInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardMember(boardId, sessionUserId);

  return BoardAnalytics.getBoardAnalytics(boardId);
}

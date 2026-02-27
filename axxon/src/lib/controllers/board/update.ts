import { Board } from '@/lib/models/board';
import { UpdateBoard } from '@/lib/types/boardTypes';
import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';
import { requireBoardCreator } from '@/lib/utils/authorization';

type UpdateBoardPayload = Partial<Pick<UpdateBoard, 'name' | 'color'>>;

type UpdateBoardInput = {
  boardId: number;
  sessionUserId: number;
  data: UpdateBoardPayload;
};

export async function updateBoard({ boardId, sessionUserId, data }: UpdateBoardInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardCreator(boardId, sessionUserId);

  const filteredData = Object.fromEntries(
    Object.entries(data ?? {}).filter(([key]) => ['name', 'color'].includes(key))
  );

  const updateData: UpdateBoard = { id: String(boardId), ...filteredData };
  const board = await Board.updateBoard(updateData);

  if (!board) {
    throw new NotFoundError('Board not found');
  }

  return board;
}

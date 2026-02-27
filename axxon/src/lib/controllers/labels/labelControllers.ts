import { Labels } from '@/lib/models/labels';
import type { CreateLabelData, UpdateLabelData } from '@/lib/types/labelTypes';
import { publishBoardUpdate } from '@/lib/wsServer';
import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';
import { requireBoardMember } from '@/lib/utils/authorization';

type CreateLabelPayload = Omit<CreateLabelData, 'board_id'>;

type UpdateLabelPayload = Partial<Pick<UpdateLabelData, 'name' | 'color'>>;

type CreateLabelInput = {
  boardId: number;
  sessionUserId: number;
  data: CreateLabelPayload;
};

type ListLabelsInput = {
  boardId: number;
  sessionUserId: number;
};

type UpdateLabelInput = {
  boardId: number;
  labelId: number;
  sessionUserId: number;
  data: UpdateLabelPayload;
};

type DeleteLabelInput = {
  boardId: number;
  labelId: number;
  sessionUserId: number;
};

type GetLabelByIdInput = {
  boardId: number;
  labelId: number;
  sessionUserId: number;
};

// Creates a label in a board.
export async function createLabel({
  boardId,
  sessionUserId,
  data,
}: CreateLabelInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const label = await Labels.createLabel({ ...data, board_id: boardId });

  // Publish label changes after persistence succeeds.
  await publishBoardUpdate(String(boardId), {
    type: 'label:created',
    payload: label,
  });

  return label;
}

// Lists labels in a board.
export async function listLabels({ boardId, sessionUserId }: ListLabelsInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardMember(boardId, sessionUserId);
  return Labels.listAllLabelsInBoard({ board_id: boardId });
}

// Updates a label in a board.
export async function updateLabel({
  boardId,
  labelId,
  sessionUserId,
  data,
}: UpdateLabelInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(labelId)) {
    throw new BadRequestError('Invalid board or label id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const allowedKeys: Array<keyof UpdateLabelPayload> = ['name', 'color'];
  const filteredBody = Object.fromEntries(
    Object.entries(data ?? {}).filter(([key]) => allowedKeys.includes(key as keyof UpdateLabelPayload))
  );

  const label = await Labels.updateLabel({ ...filteredBody, id: labelId, board_id: boardId });
  if (!label) {
    throw new NotFoundError('Label not found');
  }

  await publishBoardUpdate(String(boardId), {
    type: 'label:updated',
    payload: label,
  });

  return label;
}

// Deletes a label from a board.
export async function deleteLabel({
  boardId,
  labelId,
  sessionUserId,
}: DeleteLabelInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(labelId)) {
    throw new BadRequestError('Invalid board or label id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const deleted = await Labels.deleteLabel({ id: labelId, board_id: boardId });
  if (deleted === 0) {
    throw new NotFoundError('Label not found');
  }

  await publishBoardUpdate(String(boardId), {
    type: 'label:deleted',
    payload: { id: labelId },
  });

  return { deleted };
}

// Gets a single label in a board.
export async function getLabelById({
  boardId,
  labelId,
  sessionUserId,
}: GetLabelByIdInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(labelId)) {
    throw new BadRequestError('Invalid board or label id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const label = await Labels.getLabelById({ id: labelId, board_id: boardId });
  if (!label) {
    throw new NotFoundError('Label not found');
  }

  return label;
}

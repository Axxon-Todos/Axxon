import { Sprints } from '@/lib/models/sprints';
import type { CreateSprintData, UpdateSprintData } from '@/lib/types/sprintTypes';
import { publishBoardUpdate } from '@/lib/wsServer';
import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';
import { requireBoardMember } from '@/lib/utils/authorization';

type CreateSprintPayload = Omit<CreateSprintData, 'board_id'>;
type UpdateSprintPayload = Partial<
  Pick<UpdateSprintData, 'name' | 'description' | 'start_date' | 'end_date' | 'color' | 'icon' | 'archived_at'>
>;

type CreateSprintInput = {
  boardId: number;
  sessionUserId: number;
  data: CreateSprintPayload;
};

type ListSprintsInput = {
  boardId: number;
  sessionUserId: number;
};

type UpdateSprintInput = {
  boardId: number;
  sprintId: number;
  sessionUserId: number;
  data: UpdateSprintPayload;
};

type GetSprintByIdInput = {
  boardId: number;
  sprintId: number;
  sessionUserId: number;
};

function throwSprintRuleError(error: unknown) {
  if (
    error instanceof Error &&
    (
      error.message.includes('Sprint name is required') ||
      error.message.includes('Sprint start date is invalid') ||
      error.message.includes('Sprint end date is invalid') ||
      error.message.includes('Sprint end date must be on or after the start date') ||
      error.message.includes('Sprint icon is invalid') ||
      error.message.includes('Sprint archived date is invalid')
    )
  ) {
    throw new BadRequestError(error.message);
  }
}

export async function createSprint({ boardId, sessionUserId, data }: CreateSprintInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardMember(boardId, sessionUserId);

  let sprint;
  try {
    sprint = await Sprints.createSprint({ ...data, board_id: boardId });
  } catch (error) {
    throwSprintRuleError(error);
    throw error;
  }

  await publishBoardUpdate(String(boardId), {
    type: 'sprint:created',
    payload: sprint,
  });

  return sprint;
}

export async function listSprints({ boardId, sessionUserId }: ListSprintsInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardMember(boardId, sessionUserId);
  
  return Sprints.listSprintsInBoard({ board_id: boardId });
}

export async function updateSprint({ boardId, sprintId, sessionUserId, data }: UpdateSprintInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(sprintId)) {
    throw new BadRequestError('Invalid board or sprint id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const allowedKeys: Array<keyof UpdateSprintPayload> = [
    'name',
    'description',
    'start_date',
    'end_date',
    'color',
    'icon',
    'archived_at',
  ];
  const filteredBody = Object.fromEntries(
    Object.entries(data ?? {}).filter(([key]) => allowedKeys.includes(key as keyof UpdateSprintPayload))
  );

  let sprint;
  try {
    sprint = await Sprints.updateSprint({ ...filteredBody, id: sprintId, board_id: boardId });
  } catch (error) {
    throwSprintRuleError(error);
    throw error;
  }

  if (!sprint) {
    throw new NotFoundError('Sprint not found');
  }

  await publishBoardUpdate(String(boardId), {
    type: 'sprint:updated',
    payload: sprint,
  });

  return sprint;
}

export async function getSprintById({ boardId, sprintId, sessionUserId }: GetSprintByIdInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(sprintId)) {
    throw new BadRequestError('Invalid board or sprint id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const sprint = await Sprints.getSprintById({ id: sprintId, board_id: boardId });
  if (!sprint) {
    throw new NotFoundError('Sprint not found');
  }

  return sprint;
}

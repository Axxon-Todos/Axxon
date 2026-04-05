import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';

const {
  mockedCreateSprint,
  mockedUpdateSprint,
  mockedGetSprintById,
  mockedRequireBoardMember,
  mockedPublishBoardUpdate,
} = vi.hoisted(() => ({
  mockedCreateSprint: vi.fn(),
  mockedUpdateSprint: vi.fn(),
  mockedGetSprintById: vi.fn(),
  mockedRequireBoardMember: vi.fn(),
  mockedPublishBoardUpdate: vi.fn(),
}));

vi.mock('@/lib/models/sprints', () => ({
  Sprints: {
    createSprint: mockedCreateSprint,
    updateSprint: mockedUpdateSprint,
    getSprintById: mockedGetSprintById,
  },
}));

vi.mock('@/lib/utils/authorization', () => ({
  requireBoardMember: mockedRequireBoardMember,
}));

vi.mock('@/lib/wsServer', () => ({
  publishBoardUpdate: mockedPublishBoardUpdate,
}));

import {
  createSprint,
  getSprintById,
  updateSprint,
} from '@/lib/controllers/sprints/sprintControllers';

describe('sprintControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireBoardMember.mockResolvedValue(undefined);
  });

  it('maps sprint validation failures to a bad request', async () => {
    mockedCreateSprint.mockRejectedValue(new Error('Sprint end date must be on or after the start date'));

    await expect(
      createSprint({
        boardId: 3,
        sessionUserId: 9,
        data: {
          name: 'Bad Sprint',
          description: null,
          start_date: '2030-02-10',
          end_date: '2030-02-01',
          color: null,
          icon: 'flag',
        },
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('filters unknown update keys before hitting the model', async () => {
    mockedUpdateSprint.mockResolvedValue({
      id: 8,
      board_id: 4,
      name: 'Execution Sprint',
      description: null,
      start_date: '2030-03-01',
      end_date: '2030-03-14',
      color: '#10b981',
      icon: 'rocket',
      archived_at: null,
      created_at: '2030-02-01T00:00:00.000Z',
      updated_at: '2030-02-01T00:00:00.000Z',
    });

    await updateSprint({
      boardId: 4,
      sprintId: 8,
      sessionUserId: 2,
      data: {
        name: 'Execution Sprint',
        color: '#10b981',
        ignored: 'value',
      } as unknown as Parameters<typeof updateSprint>[0]['data'],
    });

    expect(mockedUpdateSprint).toHaveBeenCalledWith({
      id: 8,
      board_id: 4,
      name: 'Execution Sprint',
      color: '#10b981',
    });
    expect(mockedPublishBoardUpdate).toHaveBeenCalledWith('4', {
      type: 'sprint:updated',
      payload: expect.objectContaining({ id: 8, name: 'Execution Sprint' }),
    });
  });

  it('throws when a sprint lookup misses', async () => {
    mockedGetSprintById.mockResolvedValue(null);

    await expect(
      getSprintById({
        boardId: 7,
        sprintId: 99,
        sessionUserId: 1,
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

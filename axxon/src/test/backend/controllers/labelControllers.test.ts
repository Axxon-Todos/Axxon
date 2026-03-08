import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '@/lib/utils/apiErrors';

const {
  mockedUpdateLabel,
  mockedDeleteLabel,
  mockedRequireBoardMember,
  mockedPublishBoardUpdate,
} = vi.hoisted(() => ({
  mockedUpdateLabel: vi.fn(),
  mockedDeleteLabel: vi.fn(),
  mockedRequireBoardMember: vi.fn(),
  mockedPublishBoardUpdate: vi.fn(),
}));

vi.mock('@/lib/models/labels', () => ({
  Labels: {
    updateLabel: mockedUpdateLabel,
    deleteLabel: mockedDeleteLabel,
  },
}));

vi.mock('@/lib/utils/authorization', () => ({
  requireBoardMember: mockedRequireBoardMember,
}));

vi.mock('@/lib/wsServer', () => ({
  publishBoardUpdate: mockedPublishBoardUpdate,
}));

import {
  deleteLabel,
  updateLabel,
} from '@/lib/controllers/labels/labelControllers';

describe('labelControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireBoardMember.mockResolvedValue(undefined);
  });

  it('filters unknown update keys before hitting the model', async () => {
    mockedUpdateLabel.mockResolvedValue({ id: 3, name: 'UX', color: '#a855f7' });

    await updateLabel({
      boardId: 9,
      labelId: 3,
      sessionUserId: 1,
      data: {
        name: 'UX',
        color: '#a855f7',
        ignored: 'value',
      } as unknown as Parameters<typeof updateLabel>[0]['data'],
    });

    expect(mockedUpdateLabel).toHaveBeenCalledWith({
      id: 3,
      board_id: 9,
      name: 'UX',
      color: '#a855f7',
    });
    expect(mockedPublishBoardUpdate).toHaveBeenCalledWith('9', {
      type: 'label:updated',
      payload: { id: 3, name: 'UX', color: '#a855f7' },
    });
  });

  it('throws when deleting a missing label', async () => {
    mockedDeleteLabel.mockResolvedValue(0);

    await expect(
      deleteLabel({
        boardId: 4,
        labelId: 8,
        sessionUserId: 1,
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, NotFoundError } from '@/lib/utils/apiErrors';

const { mockedGetBoardById, mockedIsMember } = vi.hoisted(() => ({
  mockedGetBoardById: vi.fn(),
  mockedIsMember: vi.fn(),
}));

vi.mock('@/lib/models/board', () => ({
  Board: {
    getBoardById: mockedGetBoardById,
  },
}));

vi.mock('@/lib/models/boardMembers', () => ({
  BoardMembers: {
    isMember: mockedIsMember,
  },
}));

import {
  requireBoardCreator,
  requireBoardMember,
  requireSameUser,
} from '@/lib/utils/authorization';

describe('authorization utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces same-user access', () => {
    expect(() => requireSameUser(1, 2)).toThrow(ForbiddenError);
  });

  it('throws when a board does not exist', async () => {
    mockedGetBoardById.mockResolvedValue(null);

    await expect(requireBoardMember(1, 2)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws when a board member check fails', async () => {
    mockedGetBoardById.mockResolvedValue({ id: 1, created_by: 99 });
    mockedIsMember.mockResolvedValue(false);

    await expect(requireBoardMember(1, 2)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws when a non-creator attempts a creator-only action', async () => {
    mockedGetBoardById.mockResolvedValue({ id: 1, created_by: 77 });

    await expect(requireBoardCreator(1, 2)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

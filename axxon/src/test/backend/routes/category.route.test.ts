import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  mockedGetCategoryById,
  mockedUpdateCategory,
  mockedDeleteCategory,
  mockedRequireSession,
  mockedHandleApiError,
} = vi.hoisted(() => ({
  mockedGetCategoryById: vi.fn(),
  mockedUpdateCategory: vi.fn(),
  mockedDeleteCategory: vi.fn(),
  mockedRequireSession: vi.fn(),
  mockedHandleApiError: vi.fn(),
}));

vi.mock('@/lib/controllers/categories/categoryControllers', () => ({
  getCategoryById: mockedGetCategoryById,
  updateCategory: mockedUpdateCategory,
  deleteCategory: mockedDeleteCategory,
}));

vi.mock('@/lib/utils/auth', () => ({
  requireSession: mockedRequireSession,
}));

vi.mock('@/lib/utils/apiErrors', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/apiErrors')>(
    '@/lib/utils/apiErrors'
  );

  return {
    ...actual,
    handleApiError: mockedHandleApiError,
  };
});

import { DELETE, GET, PATCH } from '@/app/api/board/[boardId]/categories/[categoryId]/route';

describe('category item route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireSession.mockResolvedValue({ userId: 23 });
    mockedHandleApiError.mockImplementation((error: unknown) =>
      NextResponse.json({ error: String(error) }, { status: 500 })
    );
  });

  it('returns a single category from GET', async () => {
    mockedGetCategoryById.mockResolvedValue({ id: 4, name: 'Backlog' });

    const response = await GET({} as never, {
      params: Promise.resolve({ boardId: '3', categoryId: '4' }),
    });

    expect(mockedGetCategoryById).toHaveBeenCalledWith({
      boardId: 3,
      categoryId: 4,
      sessionUserId: 23,
    });
    expect(response.status).toBe(200);
  });

  it('parses the body for PATCH and delegates to the controller', async () => {
    mockedUpdateCategory.mockResolvedValue({ id: 4, name: 'Updated' });

    const response = await PATCH(
      {
        json: async () => ({ name: 'Updated' }),
      } as never,
      {
        params: Promise.resolve({ boardId: '3', categoryId: '4' }),
      }
    );

    expect(mockedUpdateCategory).toHaveBeenCalledWith({
      boardId: 3,
      categoryId: 4,
      sessionUserId: 23,
      data: { name: 'Updated' },
    });
    expect(response.status).toBe(200);
  });

  it('passes delete errors through handleApiError', async () => {
    mockedDeleteCategory.mockRejectedValue(new Error('boom'));

    const response = await DELETE({} as never, {
      params: Promise.resolve({ boardId: '3', categoryId: '4' }),
    });

    expect(mockedHandleApiError).toHaveBeenCalled();
    expect(response.status).toBe(500);
  });
});

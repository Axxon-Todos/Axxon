import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  mockedCreateTodo,
  mockedListTodos,
  mockedRequireSession,
  mockedRequireOrganizationBoardMember,
  mockedHandleApiError,
} = vi.hoisted(() => ({
  mockedCreateTodo: vi.fn(),
  mockedListTodos: vi.fn(),
  mockedRequireSession: vi.fn(),
  mockedRequireOrganizationBoardMember: vi.fn(),
  mockedHandleApiError: vi.fn(),
}));

vi.mock('@/lib/controllers/todos/todoControllers', () => ({
  createTodo: mockedCreateTodo,
  listTodos: mockedListTodos,
}));

vi.mock('@/lib/utils/auth', () => ({
  requireSession: mockedRequireSession,
}));

vi.mock('@/lib/utils/organizationBoardRoute', () => ({
  requireOrganizationBoardMember: mockedRequireOrganizationBoardMember,
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

import { GET, POST } from '@/app/api/organizations/[organizationId]/boards/[boardId]/todos/route';

describe('todos route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireSession.mockResolvedValue({ userId: 17 });
    mockedRequireOrganizationBoardMember.mockResolvedValue({ organizationId: 4, boardId: 9 });
    mockedHandleApiError.mockImplementation((error: unknown) =>
      NextResponse.json({ error: String(error) }, { status: 500 })
    );
  });

  it('returns created todos from POST', async () => {
    mockedCreateTodo.mockResolvedValue({ id: 22, title: 'Created' });

    const response = await POST(
      {
        json: async () => ({ title: 'Created' }),
      } as never,
      {
        params: Promise.resolve({ organizationId: '4', boardId: '9' }),
      }
    );

    expect(mockedRequireSession).toHaveBeenCalled();
    expect(mockedCreateTodo).toHaveBeenCalledWith({
      boardId: 9,
      sessionUserId: 17,
      data: { title: 'Created' },
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: 22, title: 'Created' });
  });

  it('passes controller errors through handleApiError', async () => {
    mockedListTodos.mockRejectedValue(new Error('boom'));

    const response = await GET({} as never, {
      params: Promise.resolve({ organizationId: '4', boardId: '9' }),
    });

    expect(mockedHandleApiError).toHaveBeenCalled();
    expect(response.status).toBe(500);
  });
});

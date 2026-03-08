import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';

const {
  mockedCreateTodo,
  mockedUpdateTodo,
  mockedDeleteTodo,
  mockedGetTodosWithLabels,
  mockedGetTodoByIdWithLabels,
  mockedRequireBoardMember,
  mockedPublishBoardUpdate,
} = vi.hoisted(() => ({
  mockedCreateTodo: vi.fn(),
  mockedUpdateTodo: vi.fn(),
  mockedDeleteTodo: vi.fn(),
  mockedGetTodosWithLabels: vi.fn(),
  mockedGetTodoByIdWithLabels: vi.fn(),
  mockedRequireBoardMember: vi.fn(),
  mockedPublishBoardUpdate: vi.fn(),
}));

vi.mock('@/lib/models/todos', () => ({
  Todos: {
    createTodo: mockedCreateTodo,
    updateTodo: mockedUpdateTodo,
    deleteTodo: mockedDeleteTodo,
  },
}));

vi.mock('@/lib/models/todoLabels', () => ({
  TodoLabels: {
    getTodosWithLabels: mockedGetTodosWithLabels,
    getTodoByIdWithLabels: mockedGetTodoByIdWithLabels,
  },
}));

vi.mock('@/lib/utils/authorization', () => ({
  requireBoardMember: mockedRequireBoardMember,
}));

vi.mock('@/lib/wsServer', () => ({
  publishBoardUpdate: mockedPublishBoardUpdate,
}));

import {
  createTodo,
  deleteTodo,
  updateTodo,
} from '@/lib/controllers/todos/todoControllers';

describe('todoControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireBoardMember.mockResolvedValue(undefined);
  });

  it('rejects invalid board ids during creation', async () => {
    await expect(
      createTodo({
        boardId: Number.NaN,
        sessionUserId: 1,
        data: { title: 'Invalid' },
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('maps completion/category rule errors to a bad request', async () => {
    mockedCreateTodo.mockRejectedValue(
      new Error('Completed todos must belong to a done category')
    );

    await expect(
      createTodo({
        boardId: 1,
        sessionUserId: 7,
        data: { title: 'Ship fix', is_complete: true },
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('maps assignee membership errors to a bad request during creation', async () => {
    mockedCreateTodo.mockRejectedValue(new Error('Assignee must be a member of the board'));

    await expect(
      createTodo({
        boardId: 1,
        sessionUserId: 7,
        data: { title: 'Ship fix', assignee_id: 44 },
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('filters unknown update keys and publishes the hydrated todo', async () => {
    mockedUpdateTodo.mockResolvedValue({ id: 14, board_id: 5, title: 'Updated' });
    mockedGetTodoByIdWithLabels.mockResolvedValue({
      id: 14,
      board_id: 5,
      title: 'Updated',
      labels: [],
    });

    const updated = await updateTodo({
      boardId: 5,
      todoId: 14,
      sessionUserId: 9,
      data: {
        title: 'Updated',
        priority: 4,
        ignored: 'value',
      } as unknown as Parameters<typeof updateTodo>[0]['data'],
    });

    expect(mockedUpdateTodo).toHaveBeenCalledWith({
      id: 14,
      board_id: 5,
      title: 'Updated',
      priority: 4,
    });
    expect(mockedPublishBoardUpdate).toHaveBeenCalledWith('5', {
      type: 'todo:updated',
      payload: updated,
    });
  });

  it('throws a not found error when deletion misses', async () => {
    mockedDeleteTodo.mockResolvedValue(0);

    await expect(
      deleteTodo({
        boardId: 2,
        todoId: 99,
        sessionUserId: 5,
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('maps assignee membership errors to a bad request during updates', async () => {
    mockedUpdateTodo.mockRejectedValue(new Error('Assignee must be a member of the board'));

    await expect(
      updateTodo({
        boardId: 2,
        todoId: 99,
        sessionUserId: 5,
        data: { assignee_id: 44 },
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

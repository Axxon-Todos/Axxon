import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedFetchCategories,
  mockedFetchBoardMembers,
  mockedFetchLabels,
  mockedCreateTodo,
  mockedUpdateTodoById,
  mockedDeleteTodoById,
  mockedUseToggleTodoLabel,
  mockedUseCreateLabel,
} = vi.hoisted(() => ({
  mockedFetchCategories: vi.fn(),
  mockedFetchBoardMembers: vi.fn(),
  mockedFetchLabels: vi.fn(),
  mockedCreateTodo: vi.fn(),
  mockedUpdateTodoById: vi.fn(),
  mockedDeleteTodoById: vi.fn(),
  mockedUseToggleTodoLabel: vi.fn(),
  mockedUseCreateLabel: vi.fn(),
}));

vi.mock('@/lib/api/categories/getCategories', () => ({
  fetchCategories: mockedFetchCategories,
}));

vi.mock('@/lib/api/boardMembers/getBoardMembers', () => ({
  fetchBoardMembers: mockedFetchBoardMembers,
}));

vi.mock('@/lib/api/labels/getLabels', () => ({
  fetchLabels: mockedFetchLabels,
}));

vi.mock('@/lib/api/todos/createTodo', () => ({
  createTodo: mockedCreateTodo,
}));

vi.mock('@/lib/api/todos/updateTodoById', () => ({
  updateTodoById: mockedUpdateTodoById,
}));

vi.mock('@/lib/api/todos/deleteTodoById', () => ({
  deleteTodoById: mockedDeleteTodoById,
}));

vi.mock('@/lib/mutations/useToggleTodoLabel', () => ({
  useToggleTodoLabel: mockedUseToggleTodoLabel,
}));

vi.mock('@/lib/mutations/useCreateLabel', () => ({
  useCreateLabel: mockedUseCreateLabel,
}));

vi.mock('@/components/features/boardView/LabelSelector', () => ({
  default: () => <div>Label selector</div>,
}));

import TodoDrawer from '@/components/features/boardView/TodoDrawer';

import { createTestQueryClient, renderWithProviders } from '../renderWithProviders';

describe('TodoDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchCategories.mockResolvedValue([
      {
        id: 4,
        board_id: 1,
        name: 'Backlog',
        color: '#94a3b8',
        position: 0,
        is_done: false,
      },
    ]);
    mockedFetchBoardMembers.mockResolvedValue([
      {
        id: 3,
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        avatar_url: null,
      },
    ]);
    mockedFetchLabels.mockResolvedValue([]);
    mockedUseToggleTodoLabel.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockedUseCreateLabel.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockedCreateTodo.mockResolvedValue({ id: 11 });
    mockedUpdateTodoById.mockResolvedValue({ id: 12 });
    mockedDeleteTodoById.mockResolvedValue({ deleted: 1 });
  });

  it('syncs form state when the todo prop changes', async () => {
    const { rerender } = renderWithProviders(
      <TodoDrawer
        mode="edit"
        boardId={1}
        todo={{
          id: 1,
          board_id: 1,
          title: 'First todo',
          description: 'First description',
          labels: [],
        }}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByDisplayValue('First todo')).toBeInTheDocument();

    rerender(
      <TodoDrawer
        mode="edit"
        boardId={1}
        todo={{
          id: 2,
          board_id: 1,
          title: 'Second todo',
          description: 'Second description',
          labels: [],
        }}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByDisplayValue('Second todo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Second description')).toBeInTheDocument();
  });

  it('blocks submit when the title is empty', async () => {
    renderWithProviders(<TodoDrawer mode="create" boardId={1} onClose={vi.fn()} />);

    const titleInput = await screen.findByPlaceholderText('Ship dashboard polish');
    fireEvent.change(titleInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Todo' }));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(mockedCreateTodo).not.toHaveBeenCalled();
  });

  it('renders board member names in the assignee selector and submits assignee ids', async () => {
    renderWithProviders(<TodoDrawer mode="create" boardId={1} onClose={vi.fn()} />);

    expect(await screen.findByRole('option', { name: 'Ada Lovelace' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ship dashboard polish'), {
      target: { value: 'Assigned todo' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Assignee' }), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Todo' }));

    await waitFor(() => {
      expect(mockedCreateTodo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          assignee_id: 3,
        })
      );
    });
  });

  it('invalidates the todos query after saving changes', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onClose = vi.fn();

    renderWithProviders(
      <TodoDrawer
        mode="edit"
        boardId={1}
        todo={{
          id: 8,
          board_id: 1,
          title: 'Existing todo',
          description: '',
          labels: [],
        }}
        onClose={onClose}
      />,
      { queryClient }
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockedUpdateTodoById).toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['todos', '1'] });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('invalidates the todos query after deleting a todo', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithProviders(
      <TodoDrawer
        mode="edit"
        boardId={1}
        todo={{
          id: 8,
          board_id: 1,
          title: 'Existing todo',
          description: '',
          labels: [],
        }}
        onClose={vi.fn()}
      />,
      { queryClient }
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Todo' }));

    await waitFor(() => {
      expect(mockedDeleteTodoById).toHaveBeenCalledWith(1, 8);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['todos', '1'] });
    });
  });
});

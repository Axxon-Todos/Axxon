// Verifies the shared todo drawer preselects and submits the lane and sprint context passed from board entry points.
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedFetchCategories,
  mockedFetchBoardMembers,
  mockedFetchLabels,
  mockedFetchSprints,
  mockedCreateTodo,
  mockedUpdateTodoById,
  mockedDeleteTodoById,
  mockedUseToggleTodoLabel,
  mockedUseCreateLabel,
} = vi.hoisted(() => ({
  mockedFetchCategories: vi.fn(),
  mockedFetchBoardMembers: vi.fn(),
  mockedFetchLabels: vi.fn(),
  mockedFetchSprints: vi.fn(),
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

vi.mock('@/lib/api/sprints/getSprints', () => ({
  fetchSprints: mockedFetchSprints,
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

vi.mock('@/hooks/useOrganizationRouteParams', () => ({
  useOrganizationRouteParams: () => ({ organizationId: '12', boardId: '1' }),
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
    mockedFetchSprints.mockResolvedValue([
      {
        id: 7,
        board_id: 1,
        name: 'Sprint 7',
        description: null,
        start_date: '2030-01-01',
        end_date: '2030-01-14',
        color: '#2563eb',
        icon: 'flag',
        archived_at: null,
        created_at: '2030-01-01T00:00:00.000Z',
        updated_at: '2030-01-01T00:00:00.000Z',
      },
      {
        id: 8,
        board_id: 1,
        name: 'Sprint 8',
        description: null,
        start_date: '2030-02-01',
        end_date: '2030-02-14',
        color: '#10b981',
        icon: 'rocket',
        archived_at: '2030-02-15T00:00:00.000Z',
        created_at: '2030-02-01T00:00:00.000Z',
        updated_at: '2030-02-15T00:00:00.000Z',
      },
    ]);
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
        '12',
        1,
        expect.objectContaining({
          assignee_id: 3,
        })
      );
    });
  });

  it('preselects and submits the current sprint for new todos', async () => {
    renderWithProviders(<TodoDrawer mode="create" boardId={1} initialSprintId={7} onClose={vi.fn()} />);

    expect(await screen.findByRole('option', { name: 'Sprint 7' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ship dashboard polish'), {
      target: { value: 'Sprint scoped todo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Todo' }));

    await waitFor(() => {
      expect(mockedCreateTodo).toHaveBeenCalledWith(
        '12',
        1,
        expect.objectContaining({
          sprint_id: 7,
        })
      );
    });
  });

  it('preselects and submits the current category for lane creation', async () => {
    renderWithProviders(<TodoDrawer mode="create" boardId={1} initialCategoryId={4} onClose={vi.fn()} />);

    await screen.findByRole('option', { name: 'Backlog' });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('4');
    });

    fireEvent.change(screen.getByPlaceholderText('Ship dashboard polish'), {
      target: { value: 'Lane scoped todo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Todo' }));

    await waitFor(() => {
      expect(mockedCreateTodo).toHaveBeenCalledWith(
        '12',
        1,
        expect.objectContaining({
          category_id: 4,
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
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['todos', '12', '1'] });
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
      expect(mockedDeleteTodoById).toHaveBeenCalledWith('12', 1, 8);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['todos', '12', '1'] });
    });
  });
});

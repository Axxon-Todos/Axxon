// Verifies the kanban view exposes lane-level task creation in empty and populated categories without changing board flow.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/features/boardView/DraggableTodo', () => ({
  default: ({ todo }: { todo: { id: number; title: string } }) => (
    <div data-testid={`todo-${todo.id}`}>{todo.title}</div>
  ),
}));

vi.mock('@/components/features/boardView/TodoDragOverlay', () => ({
  default: () => null,
}));

import BoardKanbanView from '@/components/features/boardView/views/BoardKanbanView';

import { renderWithProviders } from '../renderWithProviders';

const category = {
  id: 4,
  board_id: 1,
  name: 'Backlog',
  color: '#94a3b8',
  position: 0,
  is_done: false,
  created_at: '2030-01-01T00:00:00.000Z',
  updated_at: '2030-01-01T00:00:00.000Z',
};

const baseTodo = {
  id: 1,
  board_id: 1,
  title: 'First task',
  description: '',
  labels: [],
  created_at: '2030-01-01T00:00:00.000Z',
};

describe('BoardKanbanView', () => {
  it('renders the full-width kanban layout and lane shell structure', () => {
    const { container } = renderWithProviders(
      <BoardKanbanView
        boardColor="#6366f1"
        categoryOrder={[category.id]}
        categoryMap={{ [category.id]: category }}
        categorizedTodos={{ [category.id]: [] }}
        isManagingCategories={false}
        onTodoClick={vi.fn()}
        onTodoMove={vi.fn()}
        onStageCategoryOrder={vi.fn()}
        onSaveCategoryChanges={vi.fn().mockResolvedValue(undefined)}
        hasUnsavedCategoryChanges={false}
        canAddTodo
        onCreateTodo={vi.fn()}
      />
    );

    expect(container.firstElementChild).toHaveClass('app-kanban-layout');
    expect(screen.getByText('Backlog').closest('section')).toHaveClass('app-kanban-lane');
  });

  it('opens lane creation from empty categories', () => {
    const onCreateTodo = vi.fn();

    renderWithProviders(
      <BoardKanbanView
        boardColor="#6366f1"
        categoryOrder={[category.id]}
        categoryMap={{ [category.id]: category }}
        categorizedTodos={{ [category.id]: [] }}
        isManagingCategories={false}
        onTodoClick={vi.fn()}
        onTodoMove={vi.fn()}
        onStageCategoryOrder={vi.fn()}
        onSaveCategoryChanges={vi.fn().mockResolvedValue(undefined)}
        hasUnsavedCategoryChanges={false}
        canAddTodo
        onCreateTodo={onCreateTodo}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create task in Backlog' }));

    expect(onCreateTodo).toHaveBeenCalledWith(category.id);
  });

  it('renders the create action after existing lane todos', () => {
    renderWithProviders(
      <BoardKanbanView
        boardColor="#6366f1"
        categoryOrder={[category.id]}
        categoryMap={{ [category.id]: category }}
        categorizedTodos={{ [category.id]: [baseTodo] }}
        isManagingCategories={false}
        onTodoClick={vi.fn()}
        onTodoMove={vi.fn()}
        onStageCategoryOrder={vi.fn()}
        onSaveCategoryChanges={vi.fn().mockResolvedValue(undefined)}
        hasUnsavedCategoryChanges={false}
        canAddTodo
        onCreateTodo={vi.fn()}
      />
    );

    const todo = screen.getByTestId('todo-1');
    const button = screen.getByRole('button', { name: 'Create task in Backlog' });

    expect(todo.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('disables lane creation when the current board context is read-only', () => {
    renderWithProviders(
      <BoardKanbanView
        boardColor="#6366f1"
        categoryOrder={[category.id]}
        categoryMap={{ [category.id]: category }}
        categorizedTodos={{ [category.id]: [] }}
        isManagingCategories={false}
        onTodoClick={vi.fn()}
        onTodoMove={vi.fn()}
        onStageCategoryOrder={vi.fn()}
        onSaveCategoryChanges={vi.fn().mockResolvedValue(undefined)}
        hasUnsavedCategoryChanges={false}
        canAddTodo={false}
        onCreateTodo={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Task creation unavailable in Backlog' })).toBeDisabled();
  });

  it('shows the management banner and save action while reordering lanes', () => {
    renderWithProviders(
      <BoardKanbanView
        boardColor="#6366f1"
        categoryOrder={[category.id]}
        categoryMap={{ [category.id]: category }}
        categorizedTodos={{ [category.id]: [baseTodo] }}
        isManagingCategories
        onTodoClick={vi.fn()}
        onTodoMove={vi.fn()}
        onStageCategoryOrder={vi.fn()}
        onSaveCategoryChanges={vi.fn().mockResolvedValue(undefined)}
        hasUnsavedCategoryChanges
        canAddTodo
        onCreateTodo={vi.fn()}
      />
    );

    expect(screen.getByText('Category Management')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });
});

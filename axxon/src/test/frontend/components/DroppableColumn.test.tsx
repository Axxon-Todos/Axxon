// Covers list-lane task creation so empty and populated categories expose the correct create-task affordance.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/features/boardView/DraggableTodo', () => ({
  default: ({ todo }: { todo: { id: number; title: string } }) => (
    <div data-testid={`todo-${todo.id}`}>{todo.title}</div>
  ),
}));

import DroppableColumn from '@/components/features/boardView/DroppableColumn';

import { renderWithProviders } from '../renderWithProviders';

const baseTodo = {
  id: 1,
  board_id: 1,
  title: 'First task',
  description: '',
  labels: [],
  created_at: '2030-01-01T00:00:00.000Z',
};

describe('DroppableColumn', () => {
  it('renders the create action for empty categories and uses the lane category id', () => {
    const onCreateTodo = vi.fn();

    renderWithProviders(
      <DroppableColumn
        categoryId={4}
        categoryName="Backlog"
        todos={[]}
        onTodoClick={vi.fn()}
        onCreateTodo={onCreateTodo}
      />
    );

    const button = screen.getByRole('button', { name: 'Create task in Backlog' });

    fireEvent.click(button);

    expect(button).toBeInTheDocument();
    expect(onCreateTodo).toHaveBeenCalledWith(4);
  });

  it('renders the create action after existing todos', () => {
    renderWithProviders(
      <DroppableColumn
        categoryId={4}
        categoryName="Backlog"
        todos={[baseTodo]}
        onTodoClick={vi.fn()}
        onCreateTodo={vi.fn()}
      />
    );

    const todo = screen.getByTestId('todo-1');
    const button = screen.getByRole('button', { name: 'Create task in Backlog' });

    expect(todo.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('disables the create action when task creation is unavailable', () => {
    renderWithProviders(
      <DroppableColumn
        categoryId={4}
        categoryName="Backlog"
        todos={[]}
        onTodoClick={vi.fn()}
        canCreateTodo={false}
        onCreateTodo={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Task creation unavailable in Backlog' })).toBeDisabled();
  });
});

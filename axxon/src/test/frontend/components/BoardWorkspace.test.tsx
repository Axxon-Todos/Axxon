// Verifies board view wrappers keep list surfaces full-width while only kanban breaks out past dashboard padding.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedFetchBoard,
  mockedFetchCategories,
  mockedFetchLabels,
  mockedFetchTodosWithLabels,
} = vi.hoisted(() => ({
  mockedFetchBoard: vi.fn(),
  mockedFetchCategories: vi.fn(),
  mockedFetchLabels: vi.fn(),
  mockedFetchTodosWithLabels: vi.fn(),
}));

vi.mock('@/hooks/useOrganizationRouteParams', () => ({
  useOrganizationRouteParams: () => ({ organizationId: '3' }),
}));

vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => null,
}));

vi.mock('@/hooks/useBoardRealtime', () => ({
  useBoardRealtime: vi.fn(),
}));

vi.mock('@/lib/api/boards/getSingleBoard', () => ({
  fetchBoard: mockedFetchBoard,
}));

vi.mock('@/lib/api/categories/getCategories', () => ({
  fetchCategories: mockedFetchCategories,
}));

vi.mock('@/lib/api/labels/getLabels', () => ({
  fetchLabels: mockedFetchLabels,
}));

vi.mock('@/lib/api/todos/getTodosWithLabels', () => ({
  fetchTodosWithLabels: mockedFetchTodosWithLabels,
}));

vi.mock('@/lib/mutations/useDeleteCategory', () => ({
  useDeleteCategory: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock('@/lib/mutations/useReorderCategories', () => ({
  useReorderCategories: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/lib/mutations/UseUpdateCategory', () => ({
  useUpdateCategory: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/lib/mutations/useUpdateTodo', () => ({
  useUpdateTodoMutation: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock('@/components/features/boardView/BoardHeader', () => ({
  default: ({ onChangeView }: { onChangeView: (view: 'list' | 'kanban' | 'calendar') => void }) => (
    <div>
      <button type="button" onClick={() => onChangeView('list')}>
        Switch to list
      </button>
      <button type="button" onClick={() => onChangeView('kanban')}>
        Switch to kanban
      </button>
      <button type="button" onClick={() => onChangeView('calendar')}>
        Switch to calendar
      </button>
    </div>
  ),
}));

vi.mock('@/components/features/boardView/views/BoardListView', () => ({
  default: () => <div data-testid="board-list-view">List view</div>,
}));

vi.mock('@/components/features/boardView/views/BoardKanbanView', () => ({
  default: () => <div data-testid="board-kanban-view">Kanban view</div>,
}));

vi.mock('@/components/features/boardView/views/BoardCalendarView', () => ({
  default: () => <div data-testid="board-calendar-view">Calendar view</div>,
}));

import BoardWorkspace from '@/components/features/boardView/BoardWorkspace';

import { renderWithProviders } from '../renderWithProviders';

describe('BoardWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedFetchBoard.mockResolvedValue({
      id: 9,
      name: 'Engineering Board',
      color: '#2563eb',
      organization_id: 3,
      created_by: 7,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    });
    mockedFetchCategories.mockResolvedValue([
      {
        id: 1,
        board_id: 9,
        name: 'Backlog',
        color: '#94a3b8',
        position: 0,
        is_done: false,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
    ]);
    mockedFetchLabels.mockResolvedValue([]);
    mockedFetchTodosWithLabels.mockResolvedValue([]);
  });

  it('keeps list view full-width and only lets kanban break out of dashboard padding', async () => {
    renderWithProviders(<BoardWorkspace boardId="9" />);

    const listView = await screen.findByTestId('board-list-view');
    const listShell = listView.parentElement?.parentElement;

    expect(listShell).toHaveClass('app-page');
    expect(listShell).toHaveClass('w-full');
    expect(listShell).toHaveClass('min-w-0');
    expect(listShell).not.toHaveClass('-mx-4');

    fireEvent.click(screen.getByRole('button', { name: 'Switch to kanban' }));

    const kanbanView = await screen.findByTestId('board-kanban-view');
    const kanbanShell = kanbanView.parentElement;

    expect(kanbanShell).toHaveClass('-mx-4');
    expect(kanbanShell).toHaveClass('min-w-0');
    expect(kanbanShell).not.toHaveClass('app-page');
  });
});

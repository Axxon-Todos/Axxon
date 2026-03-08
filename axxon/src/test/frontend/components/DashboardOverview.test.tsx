import React from 'react';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedGetUserId,
  mockedFetchBoards,
  mockedFetchTodos,
  mockedFetchCategories,
} = vi.hoisted(() => ({
  mockedGetUserId: vi.fn(),
  mockedFetchBoards: vi.fn(),
  mockedFetchTodos: vi.fn(),
  mockedFetchCategories: vi.fn(),
}));

vi.mock('@/lib/api/users/getUserId', () => ({
  getUserId: mockedGetUserId,
}));

vi.mock('@/lib/api/boards/getBoards', () => ({
  fetchBoards: mockedFetchBoards,
}));

vi.mock('@/lib/api/todos/getTodos', () => ({
  fetchTodos: mockedFetchTodos,
}));

vi.mock('@/lib/api/categories/getCategories', () => ({
  fetchCategories: mockedFetchCategories,
}));

vi.mock('@/components/common/calendar', () => ({
  default: ({ selectedDate }: { selectedDate: string }) => (
    <div>Calendar selected: {selectedDate}</div>
  ),
}));

vi.mock('@/components/features/dashboard/TaskDetailsDrawer', () => ({
  default: () => <div data-testid="task-details-drawer" />,
}));

vi.mock('@/components/ui/PaginationControls', () => ({
  default: ({ page, pageCount }: { page: number; pageCount: number }) => (
    <div>
      Page {page} of {pageCount}
    </div>
  ),
}));

import DashboardOverview from '@/components/features/dashboard/DashboardOverview';

import { renderWithProviders } from '../renderWithProviders';

describe('DashboardOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the signed-out state when no user id is available', async () => {
    mockedGetUserId.mockResolvedValue(null);

    renderWithProviders(<DashboardOverview />);

    expect(await screen.findByText('Sign in to view your workspace')).toBeInTheDocument();
  });

  it('renders board and todo data from the query modules', async () => {
    mockedGetUserId.mockResolvedValue(7);
    mockedFetchBoards.mockResolvedValue([
      { id: 11, name: 'Engineering', color: '#2563eb' },
    ]);
    mockedFetchCategories.mockResolvedValue([
      { id: 4, board_id: 11, name: 'Backlog', color: '#94a3b8', position: 0, is_done: false },
    ]);
    mockedFetchTodos.mockResolvedValue([
      {
        id: 21,
        board_id: 11,
        title: 'Review test plan',
        category_id: 4,
        due_date: '2030-01-02',
        is_complete: false,
      },
    ]);

    renderWithProviders(<DashboardOverview />);

    expect(await screen.findByText('Deadlines, boards, and work in one view.')).toBeInTheDocument();
    expect(await screen.findByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText(/Calendar selected:/)).toBeInTheDocument();
  });
});

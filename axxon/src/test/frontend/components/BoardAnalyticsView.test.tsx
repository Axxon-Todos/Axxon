import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedFetchBoardAnalytics } = vi.hoisted(() => ({
  mockedFetchBoardAnalytics: vi.fn(),
}));

vi.mock('@/lib/api/boards/getBoardAnalytics', () => ({
  fetchBoardAnalytics: mockedFetchBoardAnalytics,
}));

vi.mock('@/hooks/useOrganizationRouteParams', () => ({
  useOrganizationRouteParams: () => ({ organizationId: '12', boardId: '7' }),
}));

import BoardAnalyticsView from '@/components/features/boardAnalytics/BoardAnalyticsView';

import { renderWithProviders } from '../renderWithProviders';

const analyticsFixture = {
  board: {
    id: 7,
    name: 'Engineering Board',
    color: '#2563eb',
  },
  generated_at: '2026-03-03T14:15:00.000Z',
  summary: {
    total_todos: 10,
    completed_todos: 6,
    active_todos: 4,
    unassigned_todos: 1,
    completion_rate: 60,
    category_count: 3,
    completed_category_count: 1,
    active_category_count: 2,
  },
  categories: [
    {
      category_id: 11,
      name: 'Backlog',
      color: '#94a3b8',
      position: 0,
      is_done: false,
      total_todos: 5,
      completed_todos: 1,
      active_todos: 4,
      completion_rate: 20,
    },
    {
      category_id: 12,
      name: 'In Progress',
      color: '#38bdf8',
      position: 1,
      is_done: false,
      total_todos: 3,
      completed_todos: 2,
      active_todos: 1,
      completion_rate: 66.7,
    },
    {
      category_id: 13,
      name: 'Done',
      color: '#22c55e',
      position: 2,
      is_done: true,
      total_todos: 2,
      completed_todos: 2,
      active_todos: 0,
      completion_rate: 100,
    },
  ],
  members: [
    {
      user_id: 31,
      first_name: 'Ada',
      last_name: 'Lovelace',
      avatar_url: '',
      assigned_total_todos: 6,
      assigned_completed_todos: 4,
      assigned_active_todos: 2,
      completion_rate: 66.7,
      by_category: [
        { category_id: 11, total_todos: 3, completed_todos: 1 },
        { category_id: 12, total_todos: 2, completed_todos: 2 },
        { category_id: 13, total_todos: 1, completed_todos: 1 },
      ],
    },
    {
      user_id: 32,
      first_name: 'Grace',
      last_name: 'Hopper',
      avatar_url: '',
      assigned_total_todos: 4,
      assigned_completed_todos: 2,
      assigned_active_todos: 2,
      completion_rate: 50,
      by_category: [
        { category_id: 11, total_todos: 2, completed_todos: 0 },
        { category_id: 12, total_todos: 1, completed_todos: 1 },
        { category_id: 13, total_todos: 1, completed_todos: 1 },
      ],
    },
  ],
  labels: [
    {
      label_id: 41,
      name: 'Backend',
      color: '#3b82f6',
      total_todos: 4,
      completed_todos: 3,
      active_todos: 1,
      completion_rate: 75,
      by_category: [
        { category_id: 11, total_todos: 2, completed_todos: 1 },
        { category_id: 12, total_todos: 1, completed_todos: 1 },
        { category_id: 13, total_todos: 1, completed_todos: 1 },
      ],
    },
    {
      label_id: 42,
      name: 'Frontend',
      color: '#f97316',
      total_todos: 3,
      completed_todos: 1,
      active_todos: 2,
      completion_rate: 33.3,
      by_category: [
        { category_id: 11, total_todos: 2, completed_todos: 0 },
        { category_id: 12, total_todos: 1, completed_todos: 1 },
      ],
    },
  ],
};

describe('BoardAnalyticsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders major analytics sections and board metadata', async () => {
    mockedFetchBoardAnalytics.mockResolvedValue(analyticsFixture);

    renderWithProviders(<BoardAnalyticsView boardId="7" />);

    expect(await screen.findByRole('heading', { name: 'Engineering Board' })).toBeInTheDocument();
    expect(await screen.findByText('Category Performance')).toBeInTheDocument();
    expect(screen.getByText('Tracked Todos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Members' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Board' })).toHaveAttribute(
      'href',
      '/dashboard/orgs/12/boards/7'
    );
  });

  it('updates section content when category and scope filters change', async () => {
    mockedFetchBoardAnalytics.mockResolvedValue(analyticsFixture);

    renderWithProviders(<BoardAnalyticsView boardId="7" />);

    const select = await screen.findByRole('combobox', { name: 'Filter by category' });
    fireEvent.change(select, { target: { value: '13' } });

    expect(await screen.findByRole('heading', { name: 'Done' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'active' }));

    expect(await screen.findByText('Top labels by active')).toBeInTheDocument();
  });

  it('shows contextual empty states for no analytics data', async () => {
    mockedFetchBoardAnalytics.mockResolvedValue({
      ...analyticsFixture,
      summary: {
        total_todos: 0,
        completed_todos: 0,
        active_todos: 0,
        unassigned_todos: 0,
        completion_rate: 0,
        category_count: 0,
        completed_category_count: 0,
        active_category_count: 0,
      },
      categories: [],
      members: [],
      labels: [],
    });

    renderWithProviders(<BoardAnalyticsView boardId="7" />);

    expect(await screen.findByText('No todos to chart yet for this filter.')).toBeInTheDocument();
    expect(screen.getByText('No workflow categories available for this filter.')).toBeInTheDocument();
    expect(screen.getByText('No assigned work yet for this filter.')).toBeInTheDocument();
    expect(screen.getByText('No label activity yet for this filter.')).toBeInTheDocument();
  });
});

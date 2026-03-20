import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedFetchBoards } = vi.hoisted(() => ({
  mockedFetchBoards: vi.fn(),
}));

vi.mock('@/lib/api/boards/getBoards', () => ({
  fetchBoards: mockedFetchBoards,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/orgs/3',
}));

import BoardList from '@/components/features/dashboard/BoardList';

import { renderWithProviders } from '../renderWithProviders';

describe('BoardList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an empty-state create button on the org page', async () => {
    mockedFetchBoards.mockResolvedValue([]);
    const onCreateBoard = vi.fn();

    renderWithProviders(
      <BoardList organizationId="3" onCreateBoard={onCreateBoard} />
    );

    expect(
      await screen.findByText('No boards yet. Create the first control surface for this organization.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create Board' }));

    expect(onCreateBoard).toHaveBeenCalledTimes(1);
  });
});

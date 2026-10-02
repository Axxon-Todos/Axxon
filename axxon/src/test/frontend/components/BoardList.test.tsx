import React from 'react';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedFetchBoards } = vi.hoisted(() => ({
  mockedFetchBoards: vi.fn(),
}));

vi.mock('@/lib/api/boards/getBoards', () => ({
  fetchBoards: mockedFetchBoards,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/orgs/3',
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import BoardList from '@/components/features/dashboard/BoardList';

import { renderWithProviders } from '../renderWithProviders';

describe('BoardList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state without a duplicate create button', async () => {
    mockedFetchBoards.mockResolvedValue([]);

    renderWithProviders(<BoardList organizationId="3" />);

    expect(
      await screen.findByText('No boards yet. Create the first control surface for this organization.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Board' })).not.toBeInTheDocument();
  });

  it('keeps board navigation and options separate in the organization directory', async () => {
    mockedFetchBoards.mockResolvedValue([{
      id: '9',
      name: 'Delivery',
      organization_id: 3,
      color: '#737373',
      created_by: 7,
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-30T00:00:00.000Z',
    }]);

    renderWithProviders(<BoardList organizationId="3" />);

    expect(await screen.findByRole('link', { name: 'Open Delivery' })).toHaveAttribute('href', '/dashboard/orgs/3/boards/9');
    expect(screen.getByRole('button', { name: 'Options for Delivery' })).toBeInTheDocument();
  });
});

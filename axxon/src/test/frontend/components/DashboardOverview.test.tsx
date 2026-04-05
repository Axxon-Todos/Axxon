// Verifies the organization dashboard overview renders the refreshed hero copy and organization directory.
import React from 'react';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedGetUserId,
  mockedFetchOrganizations,
} = vi.hoisted(() => ({
  mockedGetUserId: vi.fn(),
  mockedFetchOrganizations: vi.fn(),
}));

vi.mock('@/lib/api/users/getUserId', () => ({
  getUserId: mockedGetUserId,
}));

vi.mock('@/lib/api/organizations/getOrganizations', () => ({
  fetchOrganizations: mockedFetchOrganizations,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
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

    expect(await screen.findByText('Sign in to access your organizations')).toBeInTheDocument();
  });

  it('renders organization-level overview data', async () => {
    mockedGetUserId.mockResolvedValue(7);
    mockedFetchOrganizations.mockResolvedValue([
      {
        id: 11,
        name: 'Engineering',
        description: 'Platform and delivery coordination',
        color: '#2563eb',
        accessible_board_count: 3,
        member_count: 8,
      },
    ]);

    renderWithProviders(<DashboardOverview />);

    expect(
      await screen.findByText(
        'Choose the organization boundary before you enter execution.'
      )
    ).toBeInTheDocument();
    expect(await screen.findByText('Engineering')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Organization' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Engineering/i })).toHaveAttribute(
      'href',
      '/dashboard/orgs/11'
    );
    expect(screen.getByText('Accessible Boards')).toBeInTheDocument();
  });
});

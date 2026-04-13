// Verifies the sidebar org tree auto-expands the active org, loads boards lazily, and keeps quick edit owner-only.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedFetchOrganizations,
  mockedFetchBoards,
  mockedUsePathname,
} = vi.hoisted(() => ({
  mockedFetchOrganizations: vi.fn(),
  mockedFetchBoards: vi.fn(),
  mockedUsePathname: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: mockedUsePathname,
}));

vi.mock('@/hooks/useOrganizationRouteParams', () => ({
  useOrganizationRouteParams: () => ({
    organizationId: '3',
    boardId: '11',
  }),
}));

vi.mock('@/lib/api/organizations/getOrganizations', () => ({
  fetchOrganizations: mockedFetchOrganizations,
}));

vi.mock('@/lib/api/boards/getBoards', () => ({
  fetchBoards: mockedFetchBoards,
}));

vi.mock('@/components/features/dashboard/EditOrganizationModal', () => ({
  default: ({
    organization,
  }: {
    organization: { name: string };
  }) => <div role="dialog">Editing {organization.name}</div>,
}));

import SidebarOrganizationTree from '@/components/features/dashboard/SidebarOrganizationTree';

import { renderWithProviders } from '../renderWithProviders';

describe('SidebarOrganizationTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUsePathname.mockReturnValue('/dashboard/orgs/3/boards/11/analytics');
    mockedFetchOrganizations.mockResolvedValue([
      {
        id: 3,
        name: 'Platform',
        description: 'Core delivery org',
        color: '#6366f1',
        created_by: 7,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        accessible_board_count: 2,
        member_count: 4,
        repo_count: 1,
        current_user_role: 'owner',
      },
      {
        id: 4,
        name: 'Design',
        description: 'Product design org',
        color: '#0891b2',
        created_by: 8,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        accessible_board_count: 1,
        member_count: 3,
        repo_count: 0,
        current_user_role: 'member',
      },
    ]);
    mockedFetchBoards.mockImplementation(async (organizationId: string) => {
      if (organizationId === '3') {
        return [
          {
            id: '11',
            name: 'Sprint Ops',
            organization_id: 3,
            created_by: 7,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            color: '#6366f1',
          },
        ];
      }

      return [
        {
          id: '12',
          name: 'Prototype Board',
          organization_id: 4,
          created_by: 8,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          color: '#0891b2',
        },
      ];
    });
  });

  it('auto-expands the active org and lazily loads other org boards on demand', async () => {
    renderWithProviders(<SidebarOrganizationTree />);

    await waitFor(() => expect(mockedFetchOrganizations).toHaveBeenCalled());
    await waitFor(
      () =>
        expect(screen.queryByText('Loading organizations...')).not.toBeInTheDocument(),
      { timeout: 3000 }
    );

    expect(await screen.findByRole('link', { name: /Platform/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Sprint Ops' })).toHaveAttribute(
      'href',
      '/dashboard/orgs/3/boards/11'
    );
    expect(mockedFetchBoards).toHaveBeenCalledWith('3');
    expect(mockedFetchBoards).not.toHaveBeenCalledWith('4');
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Platform' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Design' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand Design' }));

    expect(await screen.findByRole('link', { name: 'Prototype Board' })).toBeInTheDocument();
    expect(mockedFetchBoards).toHaveBeenCalledWith('4');
  });
});

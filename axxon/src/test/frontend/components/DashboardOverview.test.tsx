// Verifies the main dashboard links organizations to their scoped projects and keeps sign-in available.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedGetUserId, mockedFetchOrganizations, mockedFetchProjects } = vi.hoisted(() => ({
  mockedGetUserId: vi.fn(),
  mockedFetchOrganizations: vi.fn(),
  mockedFetchProjects: vi.fn(),
}));

vi.mock('@/lib/api/users/getUserId', () => ({ getUserId: mockedGetUserId }));
vi.mock('@/lib/api/organizations/getOrganizations', () => ({ fetchOrganizations: mockedFetchOrganizations }));
vi.mock('@/lib/api/projects/getProjects', () => ({ fetchProjects: mockedFetchProjects }));
vi.mock('@/components/features/projects/CreateProjectForm', () => ({
  default: ({ organizationId }: { organizationId: string }) => <div>Creating project in {organizationId}</div>,
}));

import DashboardOverview from '@/components/features/dashboard/DashboardOverview';
import { renderWithProviders } from '../renderWithProviders';

const organizations = [
  {
    id: 11,
    name: 'Engineering',
    description: 'Platform and delivery coordination',
    color: '#737373',
    accessible_board_count: 1,
    member_count: 8,
    repo_count: 1,
    current_user_role: 'owner',
  },
  {
    id: 12,
    name: 'Design',
    description: 'Product design work',
    color: '#a3a3a3',
    accessible_board_count: 1,
    member_count: 3,
    repo_count: 0,
    current_user_role: 'member',
  },
];

describe('DashboardOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchOrganizations.mockResolvedValue(organizations);
    mockedFetchProjects.mockImplementation(async (organizationId: string) => organizationId === '11'
      ? [{ id: '24', name: 'Platform Architecture', organization_id: 11, description: null, created_by: 7, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' }]
      : [{ id: '25', name: 'Design Blueprint', organization_id: 12, description: null, created_by: 7, created_at: '2026-09-30T00:00:00.000Z', updated_at: '2026-09-30T00:00:00.000Z' }]);
  });

  it('offers sign-in when no user id is available', async () => {
    mockedGetUserId.mockResolvedValue(null);
    renderWithProviders(<DashboardOverview />);

    expect(await screen.findByText('Sign in to access your organizations')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in with Google' })).toHaveAttribute('href', '/api/auth/google');
  });

  it('switches between organizations and shows only their projects', async () => {
    mockedGetUserId.mockResolvedValue(7);
    renderWithProviders(<DashboardOverview />);

    expect(await screen.findByRole('heading', { name: 'Organizations & projects' })).toBeInTheDocument();
    await waitFor(() => expect(mockedFetchProjects).toHaveBeenCalledWith('11'));
    expect(await screen.findByRole('link', { name: /Platform Architecture/ })).toHaveAttribute('href', '/dashboard/orgs/11/projects/24');
    expect(screen.getByRole('link', { name: 'Open Engineering' })).toHaveAttribute('href', '/dashboard/orgs/11');
    expect(screen.getByRole('button', { name: 'Create organization' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Design 1 board/i }));

    expect(await screen.findByRole('link', { name: /Design Blueprint/ })).toHaveAttribute('href', '/dashboard/orgs/12/projects/25');
    expect(screen.queryByRole('link', { name: /Platform Architecture/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
    expect(screen.getByText('Creating project in 12')).toBeInTheDocument();
  });
});

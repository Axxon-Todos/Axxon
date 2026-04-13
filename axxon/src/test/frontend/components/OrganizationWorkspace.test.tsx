// Verifies the organization workspace keeps owner-only controls tied to the org summary role while rendering member management data.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedFetchOrganization,
  mockedFetchOrganizationMembers,
} = vi.hoisted(() => ({
  mockedFetchOrganization: vi.fn(),
  mockedFetchOrganizationMembers: vi.fn(),
}));

vi.mock('@/lib/api/organizations/getOrganization', () => ({
  fetchOrganization: mockedFetchOrganization,
}));

vi.mock('@/lib/api/organizations/getOrganizationMembers', () => ({
  fetchOrganizationMembers: mockedFetchOrganizationMembers,
}));

vi.mock('@/components/features/dashboard/BoardList', () => ({
  default: ({ organizationId }: { organizationId: string }) => (
    <div data-testid="board-list">Board list for {organizationId}</div>
  ),
}));

vi.mock('@/components/features/dashboard/OrganizationGitHubPanel', () => ({
  default: ({
    organizationId,
    isOwner,
  }: {
    organizationId: string;
    isOwner: boolean;
  }) => (
    <div data-testid="github-panel">
      GitHub panel for {organizationId} ({isOwner ? 'owner' : 'member'})
    </div>
  ),
}));

import OrganizationWorkspace from '@/components/features/dashboard/OrganizationWorkspace';

import { renderWithProviders } from '../renderWithProviders';

describe('OrganizationWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchOrganization.mockResolvedValue({
      id: 3,
      name: 'Platform',
      description: 'Org workspace',
      color: '#0f766e',
      created_by: 7,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      accessible_board_count: 2,
      member_count: 2,
      repo_count: 0,
      current_user_role: 'owner',
    });
  });

  it('shows edit controls for organization owners', async () => {
    mockedFetchOrganizationMembers.mockResolvedValue([
      {
        id: 7,
        email: 'owner@example.com',
        first_name: 'Owner',
        last_name: 'User',
        avatar_url: null,
        organization_id: 3,
        role: 'owner',
      },
    ]);

    renderWithProviders(<OrganizationWorkspace organizationId="3" />);

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Board' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Organization' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite Members' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create Board' }));

    expect(await screen.findByRole('heading', { name: 'Create New Board' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Organization' }));

    expect(await screen.findByRole('heading', { name: 'Edit Organization' })).toBeInTheDocument();
  });

  it('hides edit controls for non-owners while keeping board creation visible', async () => {
    mockedFetchOrganization.mockResolvedValue({
      id: 3,
      name: 'Platform',
      description: 'Org workspace',
      color: '#0f766e',
      created_by: 7,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      accessible_board_count: 2,
      member_count: 2,
      repo_count: 0,
      current_user_role: 'member',
    });
    mockedFetchOrganizationMembers.mockResolvedValue([
      {
        id: 9,
        email: 'member@example.com',
        first_name: 'Member',
        last_name: 'User',
        avatar_url: null,
        organization_id: 3,
        role: 'member',
      },
    ]);

    renderWithProviders(<OrganizationWorkspace organizationId="3" />);

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Board' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Organization' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite Members' })).not.toBeInTheDocument();
  });
});

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedFetchBoard,
  mockedFetchOrganizationMembers,
  mockedFetchBoardMembers,
  mockedGetOrganizationRepositories,
  mockedGetBoardRepositories,
  mockedGetOrganizationBoardRepositoryAccess,
  mockedUpdateBoardRepositories,
  mockedRemoveBoardMember,
  mockedGetUserId,
} = vi.hoisted(() => ({
  mockedFetchBoard: vi.fn(),
  mockedFetchOrganizationMembers: vi.fn(),
  mockedFetchBoardMembers: vi.fn(),
  mockedGetOrganizationRepositories: vi.fn(),
  mockedGetBoardRepositories: vi.fn(),
  mockedGetOrganizationBoardRepositoryAccess: vi.fn(),
  mockedUpdateBoardRepositories: vi.fn(),
  mockedRemoveBoardMember: vi.fn(),
  mockedGetUserId: vi.fn(),
}));

vi.mock('@/hooks/useOrganizationRouteParams', () => ({
  useOrganizationRouteParams: () => ({ organizationId: '3', boardId: '9' }),
}));

vi.mock('@/lib/api/boards/getSingleBoard', () => ({
  fetchBoard: mockedFetchBoard,
}));

vi.mock('@/lib/api/organizations/getOrganizationMembers', () => ({
  fetchOrganizationMembers: mockedFetchOrganizationMembers,
}));

vi.mock('@/lib/api/boardMembers/getBoardMembers', () => ({
  fetchBoardMembers: mockedFetchBoardMembers,
}));

vi.mock('@/lib/api/integrations/github/getOrganizationRepositories', () => ({
  getOrganizationRepositories: mockedGetOrganizationRepositories,
}));

vi.mock('@/lib/api/boardRepositories/getBoardRepositories', () => ({
  getBoardRepositories: mockedGetBoardRepositories,
}));

vi.mock('@/lib/api/boardRepositories/getOrganizationBoardRepositoryAccess', () => ({
  getOrganizationBoardRepositoryAccess: mockedGetOrganizationBoardRepositoryAccess,
}));

vi.mock('@/lib/api/boardRepositories/updateBoardRepositories', () => ({
  updateBoardRepositories: mockedUpdateBoardRepositories,
}));

vi.mock('@/lib/api/boardMembers/removeBoardMember', () => ({
  removeBoardMember: mockedRemoveBoardMember,
}));

vi.mock('@/lib/api/users/getUserId', () => ({
  getUserId: mockedGetUserId,
}));

vi.mock('@/components/features/dashboard/InviteMembersModal', () => ({
  default: ({
    organizationId,
    boardId,
  }: {
    organizationId: number;
    boardId: number;
  }) => (
    <div data-testid="invite-board-members-modal">
      Invite members for {organizationId}-{boardId}
    </div>
  ),
}));

import BoardSettingsView from '@/components/features/boardSettings/BoardSettingsView';
import { renderWithProviders } from '../renderWithProviders';

describe('BoardSettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetUserId.mockResolvedValue('7');
    mockedFetchBoard.mockResolvedValue({
      id: 9,
      name: 'Engineering Board',
      color: '#2563eb',
      organization_id: 3,
      created_by: 7,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    });
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
    mockedFetchBoardMembers.mockResolvedValue([
      {
        id: 7,
        email: 'owner@example.com',
        first_name: 'Owner',
        last_name: 'User',
        avatar_url: null,
      },
      {
        id: 9,
        email: 'member@example.com',
        first_name: 'Member',
        last_name: 'User',
        avatar_url: null,
      },
    ]);
    mockedGetOrganizationRepositories.mockResolvedValue({
      installation: null,
      repositories: [
        {
          id: 1,
          organization_id: 3,
          github_installation_id: '123',
          github_repo_id: '555',
          name: 'platform',
          full_name: 'axxon/platform',
          owner_login: 'axxon',
          default_branch: 'main',
          private: true,
          archived: false,
          html_url: 'https://github.com/axxon/platform',
          is_active: true,
          raw_json: null,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
      ],
    });
    mockedGetBoardRepositories.mockResolvedValue({
      repositories: [
        {
          id: 1,
          organization_id: 3,
          github_installation_id: '123',
          github_repo_id: '555',
          name: 'platform',
          full_name: 'axxon/platform',
          owner_login: 'axxon',
          default_branch: 'main',
          private: true,
          archived: false,
          html_url: 'https://github.com/axxon/platform',
          is_active: true,
          raw_json: null,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
      ],
    });
    mockedGetOrganizationBoardRepositoryAccess.mockResolvedValue({
      boards: [
        {
          id: '9',
          name: 'Engineering Board',
          color: '#2563eb',
          organization_id: 3,
          created_by: 7,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
      ],
      repositories: [
        {
          id: 1,
          organization_id: 3,
          github_installation_id: '123',
          github_repo_id: '555',
          name: 'platform',
          full_name: 'axxon/platform',
          owner_login: 'axxon',
          default_branch: 'main',
          private: true,
          archived: false,
          html_url: 'https://github.com/axxon/platform',
          is_active: true,
          raw_json: null,
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z',
        },
      ],
      links: [{ board_id: 9, repository_id: 1 }],
    });
    mockedUpdateBoardRepositories.mockResolvedValue({ repositories: [] });
    mockedRemoveBoardMember.mockResolvedValue({ removed: 1 });
  });

  it('renders member and repository settings and allows creator actions', async () => {
    renderWithProviders(<BoardSettingsView boardId="9" />);

    expect(await screen.findByRole('heading', { name: 'Engineering Board' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Members' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.getByText('Board to repository access')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add Members' }));
    expect(screen.getByTestId('invite-board-members-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => {
      expect(mockedRemoveBoardMember).toHaveBeenCalledWith({
        organizationId: '3',
        boardId: '9',
        userId: 9,
      });
    });
  });

  it('saves repository access changes for org owners', async () => {
    renderWithProviders(<BoardSettingsView boardId="9" />);

    const checkbox = await screen.findByRole('checkbox');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Save Repository Access' }));

    await waitFor(() => {
      expect(mockedUpdateBoardRepositories).toHaveBeenCalledWith({
        organizationId: '3',
        boardId: '9',
        repositoryIds: [],
      });
    });
  });
});

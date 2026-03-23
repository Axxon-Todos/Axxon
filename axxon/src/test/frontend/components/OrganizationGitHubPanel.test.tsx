import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedGetOrganizationRepositories,
  mockedStartGitHubInstall,
  mockedSyncGitHubRepositories,
  mockedRedirectBrowserTo,
} = vi.hoisted(() => ({
  mockedGetOrganizationRepositories: vi.fn(),
  mockedStartGitHubInstall: vi.fn(),
  mockedSyncGitHubRepositories: vi.fn(),
  mockedRedirectBrowserTo: vi.fn(),
}));

vi.mock('@/lib/api/integrations/github/getOrganizationRepositories', () => ({
  getOrganizationRepositories: mockedGetOrganizationRepositories,
}));

vi.mock('@/lib/api/integrations/github/startGitHubInstall', () => ({
  startGitHubInstall: mockedStartGitHubInstall,
}));

vi.mock('@/lib/api/integrations/github/syncGitHubRepositories', () => ({
  syncGitHubRepositories: mockedSyncGitHubRepositories,
}));

vi.mock('@/lib/utils/browser', () => ({
  redirectBrowserTo: mockedRedirectBrowserTo,
}));

import OrganizationGitHubPanel from '@/components/features/dashboard/OrganizationGitHubPanel';
import { renderWithProviders } from '../renderWithProviders';

describe('OrganizationGitHubPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSyncGitHubRepositories.mockResolvedValue({
      installation: null,
      syncedCount: 2,
      deactivatedCount: 0,
    });
  });

  it('shows connected repositories and owner actions', async () => {
    mockedGetOrganizationRepositories.mockResolvedValue({
      installation: {
        organization_id: 3,
        github_installation_id: '123',
        github_account_id: '456',
        github_account_login: 'axxon-org',
        github_account_type: 'Organization',
        repository_selection: 'all',
        status: 'active',
        installed_by_user_id: 7,
        last_synced_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      },
      repositories: [
        {
          id: 1,
          organization_id: 3,
          github_installation_id: '123',
          github_repo_id: '999',
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

    renderWithProviders(
      <OrganizationGitHubPanel organizationId="3" isOwner />
    );

    expect(await screen.findByText('GitHub App connection')).toBeInTheDocument();
    expect(await screen.findByText('axxon/platform')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync Repositories' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sync Repositories' }));

    await waitFor(() => {
      expect(mockedSyncGitHubRepositories).toHaveBeenCalledWith('3');
    });
  });

  it('redirects owners into the GitHub install flow', async () => {
    mockedGetOrganizationRepositories.mockResolvedValue({
      installation: null,
      repositories: [],
    });
    mockedStartGitHubInstall.mockResolvedValue({
      installUrl: 'https://github.com/apps/axxon/installations/new',
    });

    renderWithProviders(
      <OrganizationGitHubPanel organizationId="3" isOwner />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Connect GitHub' }));

    await waitFor(() => {
      expect(mockedRedirectBrowserTo).toHaveBeenCalledWith(
        'https://github.com/apps/axxon/installations/new'
      );
    });
  });
});

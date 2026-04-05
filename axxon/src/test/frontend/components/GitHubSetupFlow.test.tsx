import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedFinalizeGitHubInstallationRequest,
  mockedUseSearchParams,
  mockedRedirectBrowserTo,
} = vi.hoisted(() => ({
  mockedFinalizeGitHubInstallationRequest: vi.fn(),
  mockedUseSearchParams: vi.fn(),
  mockedRedirectBrowserTo: vi.fn(),
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>(
    'next/navigation'
  );

  return {
    ...actual,
    useSearchParams: mockedUseSearchParams,
  };
});

vi.mock('@/lib/api/integrations/github/finalizeGitHubInstallation', () => ({
  finalizeGitHubInstallationRequest: mockedFinalizeGitHubInstallationRequest,
}));

vi.mock('@/lib/utils/browser', () => ({
  redirectBrowserTo: mockedRedirectBrowserTo,
}));

import GitHubSetupFlow from '@/components/features/dashboard/GitHubSetupFlow';
import { renderWithProviders } from '../renderWithProviders';

describe('GitHubSetupFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) =>
        (
          {
            installation_id: '123',
            state: 'signed-state',
            setup_action: 'install',
          } as Record<string, string>
        )[key] ?? null,
    });
  });

  it('renders a success state after finalization completes', async () => {
    mockedFinalizeGitHubInstallationRequest.mockResolvedValue({
      status: 'connected',
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
      repositoriesSynced: 4,
    });

    renderWithProviders(<GitHubSetupFlow organizationId="3" />);

    expect(
      await screen.findByRole('heading', { name: 'GitHub is connected' })
    ).toBeInTheDocument();
    expect(screen.getByText(/4 repositories were synced/i)).toBeInTheDocument();
  });

  it('redirects to GitHub when callback verification is required', async () => {
    mockedFinalizeGitHubInstallationRequest.mockResolvedValue({
      status: 'authorization_required',
      authorizationUrl: 'https://github.com/login/oauth/authorize?state=callback',
    });

    renderWithProviders(<GitHubSetupFlow organizationId="3" />);

    await waitFor(() => {
      expect(mockedRedirectBrowserTo).toHaveBeenCalledWith(
        'https://github.com/login/oauth/authorize?state=callback'
      );
    });
  });
});

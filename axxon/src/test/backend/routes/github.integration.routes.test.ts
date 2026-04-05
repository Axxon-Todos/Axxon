import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  mockedStartOrganizationGitHubInstall,
  mockedFinalizeOrganizationGitHubInstall,
  mockedSyncOrganizationGitHubRepositories,
  mockedListOrganizationRepositories,
  mockedResolveGitHubAuthorizationCallbackRedirect,
  mockedProcessGitHubWebhook,
  mockedRequireSession,
  mockedHandleApiError,
} = vi.hoisted(() => ({
  mockedStartOrganizationGitHubInstall: vi.fn(),
  mockedFinalizeOrganizationGitHubInstall: vi.fn(),
  mockedSyncOrganizationGitHubRepositories: vi.fn(),
  mockedListOrganizationRepositories: vi.fn(),
  mockedResolveGitHubAuthorizationCallbackRedirect: vi.fn(),
  mockedProcessGitHubWebhook: vi.fn(),
  mockedRequireSession: vi.fn(),
  mockedHandleApiError: vi.fn(),
}));

vi.mock('@/lib/controllers/integrations/github/githubIntegrationControllers', () => ({
  startOrganizationGitHubInstall: mockedStartOrganizationGitHubInstall,
  finalizeOrganizationGitHubInstall: mockedFinalizeOrganizationGitHubInstall,
  syncOrganizationGitHubRepositories: mockedSyncOrganizationGitHubRepositories,
  listOrganizationRepositories: mockedListOrganizationRepositories,
  resolveGitHubAuthorizationCallbackRedirect:
    mockedResolveGitHubAuthorizationCallbackRedirect,
  processGitHubWebhook: mockedProcessGitHubWebhook,
}));

vi.mock('@/lib/utils/auth', () => ({
  requireSession: mockedRequireSession,
}));

vi.mock('@/lib/utils/apiErrors', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/apiErrors')>(
    '@/lib/utils/apiErrors'
  );

  return {
    ...actual,
    handleApiError: mockedHandleApiError,
  };
});

import { POST as installPost } from '@/app/api/organizations/[organizationId]/integrations/github/install/route';
import { POST as finalizePost } from '@/app/api/organizations/[organizationId]/integrations/github/finalize/route';
import { POST as syncPost } from '@/app/api/organizations/[organizationId]/integrations/github/sync/route';
import { GET as repositoriesGet } from '@/app/api/organizations/[organizationId]/repositories/route';
import { GET as callbackGet } from '@/app/api/integrations/github/callback/route';
import { POST as webhookPost } from '@/app/api/webhooks/github/route';

describe('GitHub integration routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_BASE_URL = 'https://axxon.example.com';
    mockedRequireSession.mockResolvedValue({ userId: 17 });
    mockedHandleApiError.mockImplementation((error: unknown) =>
      NextResponse.json({ error: String(error) }, { status: 500 })
    );
  });

  it('starts an org-scoped GitHub installation', async () => {
    mockedStartOrganizationGitHubInstall.mockResolvedValue({
      installUrl: 'https://github.com/apps/axxon/installations/new',
    });

    const response = await installPost({} as never, {
      params: Promise.resolve({ organizationId: '3' }),
    });

    expect(mockedStartOrganizationGitHubInstall).toHaveBeenCalledWith({
      organizationId: 3,
      sessionUserId: 17,
    });
    expect(response.status).toBe(200);
  });

  it('finalizes an org-scoped GitHub installation', async () => {
    mockedFinalizeOrganizationGitHubInstall.mockResolvedValue({
      status: 'connected',
    });

    const response = await finalizePost(
      {
        json: async () => ({
          installationId: '123',
          state: 'signed-state',
        }),
      } as never,
      {
        params: Promise.resolve({ organizationId: '3' }),
      }
    );

    expect(mockedFinalizeOrganizationGitHubInstall).toHaveBeenCalledWith({
      organizationId: 3,
      sessionUserId: 17,
      data: {
        installationId: '123',
        state: 'signed-state',
      },
    });
    expect(response.status).toBe(200);
  });

  it('syncs an org-scoped GitHub installation', async () => {
    mockedSyncOrganizationGitHubRepositories.mockResolvedValue({
      syncedCount: 2,
      deactivatedCount: 0,
    });

    const response = await syncPost({} as never, {
      params: Promise.resolve({ organizationId: '3' }),
    });

    expect(mockedSyncOrganizationGitHubRepositories).toHaveBeenCalledWith({
      organizationId: 3,
      sessionUserId: 17,
    });
    expect(response.status).toBe(200);
  });

  it('lists repositories for an organization', async () => {
    mockedListOrganizationRepositories.mockResolvedValue({
      installation: null,
      repositories: [],
    });

    const response = await repositoriesGet({} as never, {
      params: Promise.resolve({ organizationId: '3' }),
    });

    expect(mockedListOrganizationRepositories).toHaveBeenCalledWith({
      organizationId: 3,
      sessionUserId: 17,
    });
    expect(response.status).toBe(200);
  });

  it('redirects GitHub callbacks back into the app', async () => {
    mockedResolveGitHubAuthorizationCallbackRedirect.mockResolvedValue(
      '/dashboard/orgs/3/integrations/github/setup?installation_id=123'
    );

    const response = await callbackGet({
      nextUrl: {
        searchParams: new URLSearchParams({
          code: 'oauth-code',
          state: 'signed-state',
        }),
      },
    } as never);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://axxon.example.com/dashboard/orgs/3/integrations/github/setup?installation_id=123'
    );
  });

  it('accepts new webhook deliveries and returns 202', async () => {
    mockedProcessGitHubWebhook.mockResolvedValue({
      duplicate: false,
      processed: true,
    });

    const response = await webhookPost({
      text: async () => '{"action":"created"}',
      headers: new Headers(),
    } as never);

    expect(mockedProcessGitHubWebhook).toHaveBeenCalled();
    expect(response.status).toBe(202);
  });

  it('returns 200 for duplicate webhook deliveries', async () => {
    mockedProcessGitHubWebhook.mockResolvedValue({
      duplicate: true,
      processed: false,
    });

    const response = await webhookPost({
      text: async () => '{"action":"created"}',
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(200);
  });
});

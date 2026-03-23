// Orchestrates the end-to-end GitHub install, callback, finalize, listing, and sync workflows.
import { getGitHubAppMetadata, getGitHubInstallationDetails } from '@/lib/github/appAuth';
import {
  buildGitHubUserAuthorizationUrl,
  ensureGitHubUserCanAccessInstallation,
  exchangeGitHubUserAuthorizationCode,
  getGitHubAuthenticatedUser,
} from '@/lib/github/userAuth';
import { GithubInstallations } from '@/lib/models/githubInstallations';
import { Repositories } from '@/lib/models/repositories';
import { syncRepositoriesForInstallation } from '@/lib/integrations/github/repositorySync';
import {
  createGitHubCallbackStateToken,
  createGitHubInstallStateToken,
  createGitHubVerificationToken,
  verifyGitHubCallbackStateToken,
  verifyGitHubInstallStateToken,
  verifyGitHubVerificationToken,
} from '@/lib/integrations/github/state';
import type {
  GithubFinalizeResponse,
  GithubInstallationSummary,
  GithubSetupAction,
  OrganizationRepositoriesResponse,
} from '@/lib/types/githubIntegrationTypes';
import {
  BadRequestError,
  NotFoundError,
} from '@/lib/utils/apiErrors';
import {
  buildOrganizationGitHubSetupPath,
} from '@/lib/utils/routes';

function normalizeSetupAction(value: string | null | undefined): GithubSetupAction {
  if (!value) {
    return null;
  }

  if (value === 'install' || value === 'update') {
    return value;
  }

  throw new BadRequestError('Invalid GitHub setup action');
}

function normalizeGithubInstallationId(installationId: string) {
  const trimmedInstallationId = installationId?.trim();

  if (!trimmedInstallationId || !/^\d+$/.test(trimmedInstallationId)) {
    throw new BadRequestError('Invalid GitHub installation id');
  }

  return trimmedInstallationId;
}

function toInstallationSummary(
  installation: Awaited<
    ReturnType<typeof GithubInstallations.getByGithubInstallationId>
  >
): GithubInstallationSummary {
  if (!installation) {
    throw new NotFoundError('GitHub installation not found');
  }

  return {
    organization_id: installation.organization_id,
    github_installation_id: installation.github_installation_id,
    github_account_id: installation.github_account_id,
    github_account_login: installation.github_account_login,
    github_account_type: installation.github_account_type,
    repository_selection: installation.repository_selection,
    status: installation.status,
    installed_by_user_id: installation.installed_by_user_id,
    last_synced_at: installation.last_synced_at,
    updated_at: installation.updated_at,
  };
}

function buildSetupRedirectPath({
  organizationId,
  installationId,
  setupAction,
  state,
  verificationToken,
  error,
}: {
  organizationId: number;
  installationId: string;
  setupAction: GithubSetupAction;
  state?: string;
  verificationToken?: string;
  error?: string;
}) {
  const searchParams = new URLSearchParams({
    installation_id: installationId,
  });

  if (setupAction) {
    searchParams.set('setup_action', setupAction);
  }

  if (state) {
    searchParams.set('state', state);
  }

  if (verificationToken) {
    searchParams.set('verification_token', verificationToken);
  }

  if (error) {
    searchParams.set('error', error);
  }

  return `${buildOrganizationGitHubSetupPath(organizationId)}?${searchParams.toString()}`;
}

export async function buildGitHubInstallationStart({
  organizationId,
  userId,
}: {
  organizationId: number;
  userId: number;
}) {
  const installState = await createGitHubInstallStateToken({
    organizationId,
    userId,
  });
  const app = await getGitHubAppMetadata();
  const installUrl = new URL(
    `https://github.com/apps/${app.slug}/installations/new`
  );

  installUrl.search = new URLSearchParams({
    state: installState,
  }).toString();

  return {
    installUrl: installUrl.toString(),
  };
}

export async function finalizeGitHubInstallation({
  organizationId,
  userId,
  installationId,
  state,
  verificationToken,
  setupAction,
}: {
  organizationId: number;
  userId: number;
  installationId: string;
  state: string;
  verificationToken?: string;
  setupAction?: GithubSetupAction;
}): Promise<GithubFinalizeResponse> {
  const normalizedInstallationId = normalizeGithubInstallationId(installationId);
  const installState = await verifyGitHubInstallStateToken(state);

  if (
    installState.organizationId !== organizationId ||
    installState.userId !== userId
  ) {
    throw new BadRequestError('GitHub installation state does not match the current organization');
  }

  let verifiedToken = null;

  if (verificationToken) {
    try {
      verifiedToken = await verifyGitHubVerificationToken(verificationToken);
    } catch {
      verifiedToken = null;
    }
  }

  if (
    !verifiedToken ||
    verifiedToken.organizationId !== organizationId ||
    verifiedToken.userId !== userId ||
    verifiedToken.installationId !== normalizedInstallationId
  ) {
    const callbackState = await createGitHubCallbackStateToken({
      organizationId,
      userId,
      installationId: normalizedInstallationId,
      setupAction: normalizeSetupAction(setupAction),
      installState: state,
    });

    return {
      status: 'authorization_required',
      authorizationUrl: buildGitHubUserAuthorizationUrl(callbackState),
    };
  }

  const installation = await getGitHubInstallationDetails(normalizedInstallationId);

  await GithubInstallations.markOtherInstallationsRemovedForOrganization(
    organizationId,
    normalizedInstallationId
  );
  await GithubInstallations.upsertInstallation({
    organization_id: organizationId,
    github_installation_id: normalizedInstallationId,
    github_account_id: String(installation.account.id),
    github_account_login: installation.account.login,
    github_account_type: installation.account.type,
    repository_selection:
      installation.repository_selection === 'selected' ? 'selected' : 'all',
    status: 'active',
    installed_by_user_id: userId,
  });

  const syncResult = await syncRepositoriesForInstallation({
    organizationId,
    githubInstallationId: normalizedInstallationId,
  });
  const persistedInstallation = await GithubInstallations.getByGithubInstallationId(
    normalizedInstallationId
  );

  return {
    status: 'connected',
    installation: toInstallationSummary(persistedInstallation),
    repositoriesSynced: syncResult.syncedCount,
  };
}

export async function syncGitHubRepositoriesForOrganization({
  organizationId,
}: {
  organizationId: number;
}) {
  const installation = await GithubInstallations.getCurrentForOrganization(
    organizationId
  );

  if (!installation || installation.status !== 'active') {
    throw new NotFoundError('No active GitHub installation is connected to this organization');
  }

  const syncResult = await syncRepositoriesForInstallation({
    organizationId,
    githubInstallationId: installation.github_installation_id,
  });
  const refreshedInstallation = await GithubInstallations.getByGithubInstallationId(
    installation.github_installation_id
  );

  return {
    installation: toInstallationSummary(refreshedInstallation),
    syncedCount: syncResult.syncedCount,
    deactivatedCount: syncResult.deactivatedCount,
  };
}

export async function getRepositoriesForOrganization({
  organizationId,
}: {
  organizationId: number;
}): Promise<OrganizationRepositoriesResponse> {
  const installation = await GithubInstallations.getCurrentForOrganization(
    organizationId
  );
  const repositories = await Repositories.listForOrganization(organizationId);

  return {
    installation: installation ? toInstallationSummary(installation) : null,
    repositories,
  };
}

export async function handleGitHubAuthorizationCallback({
  code,
  state,
  error,
}: {
  code?: string | null;
  state?: string | null;
  error?: string | null;
}) {
  if (!state) {
    throw new BadRequestError('Missing GitHub callback state');
  }

  const callbackState = await verifyGitHubCallbackStateToken(state);

  if (error) {
    return buildSetupRedirectPath({
      organizationId: callbackState.organizationId,
      installationId: callbackState.installationId,
      setupAction: callbackState.setupAction,
      state: callbackState.installState,
      error,
    });
  }

  if (!code) {
    throw new BadRequestError('Missing GitHub authorization code');
  }

  const token = await exchangeGitHubUserAuthorizationCode(code);
  const githubUser = await getGitHubAuthenticatedUser(token);

  await ensureGitHubUserCanAccessInstallation({
    token,
    installationId: callbackState.installationId,
  });

  const verificationToken = await createGitHubVerificationToken({
    organizationId: callbackState.organizationId,
    userId: callbackState.userId,
    installationId: callbackState.installationId,
    githubUserId: String(githubUser.id),
    githubUserLogin: githubUser.login,
  });

  return buildSetupRedirectPath({
    organizationId: callbackState.organizationId,
    installationId: callbackState.installationId,
    setupAction: callbackState.setupAction,
    state: callbackState.installState,
    verificationToken,
  });
}

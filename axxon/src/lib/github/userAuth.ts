// Handles GitHub user OAuth exchange and checks whether the user can access an installation.
import { githubJsonRequest } from '@/lib/github/apiClient';
import {
  getGitHubAppClientId,
  getGitHubAppClientSecret,
  getGitHubCallbackUrl,
  getGitHubOauthBaseUrl,
} from '@/lib/github/env';
import { BadRequestError, UnauthorizedError } from '@/lib/utils/apiErrors';

type GitHubOauthTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  token_type?: string;
};

type GitHubUser = {
  id: number;
  login: string;
};

type GitHubUserInstallationsResponse = {
  installations: Array<{
    id: number;
  }>;
};

export function buildGitHubUserAuthorizationUrl(state: string) {
  const url = new URL('/login/oauth/authorize', getGitHubOauthBaseUrl());

  url.search = new URLSearchParams({
    client_id: getGitHubAppClientId(),
    redirect_uri: getGitHubCallbackUrl(),
    state,
  }).toString();

  return url.toString();
}

export async function exchangeGitHubUserAuthorizationCode(code: string) {
  const res = await fetch(`${getGitHubOauthBaseUrl()}/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: getGitHubAppClientId(),
      client_secret: getGitHubAppClientSecret(),
      code,
      redirect_uri: getGitHubCallbackUrl(),
    }),
    cache: 'no-store',
  });

  let data: GitHubOauthTokenResponse;
  try {
    data = (await res.json()) as GitHubOauthTokenResponse;
  } catch {
    throw new BadRequestError('Failed to exchange the GitHub authorization code');
  }

  if (!res.ok || !data.access_token || data.error) {
    throw new BadRequestError(
      data.error_description || 'Failed to exchange the GitHub authorization code'
    );
  }

  return data.access_token;
}

export async function getGitHubAuthenticatedUser(token: string) {
  return githubJsonRequest<GitHubUser>('/user', { token });
}

export async function ensureGitHubUserCanAccessInstallation({
  token,
  installationId,
}: {
  token: string;
  installationId: string;
}) {
  const installations = await githubJsonRequest<GitHubUserInstallationsResponse>(
    '/user/installations',
    { token }
  );

  const hasAccess = installations.installations.some(
    (installation) => String(installation.id) === installationId
  );

  if (!hasAccess) {
    throw new UnauthorizedError(
      'The authenticated GitHub user cannot access this installation'
    );
  }
}

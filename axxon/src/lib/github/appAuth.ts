// Manages GitHub App authentication, app metadata lookup, and installation access tokens.
import { createPrivateKey } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { githubJsonRequest } from '@/lib/github/apiClient';
import {
  getGitHubAppId,
  getGitHubAppPrivateKey,
} from '@/lib/github/env';

type GitHubAppMetadata = {
  id: number;
  slug: string;
  name: string;
};

type GitHubInstallationAccount = {
  id: number;
  login: string;
  type: string;
};

export type GitHubInstallationDetails = {
  id: number;
  account: GitHubInstallationAccount;
  repository_selection: 'all' | 'selected';
};

type GitHubInstallationAccessTokenResponse = {
  token: string;
  expires_at: string;
};

let signingKeyPromise: Promise<CryptoKey> | null = null;
let appMetadataPromise: Promise<GitHubAppMetadata> | null = null;

function normalizePrivateKey(privateKey: string) {
  if (!privateKey.includes('BEGIN RSA PRIVATE KEY')) {
    return privateKey;
  }

  return createPrivateKey(privateKey)
    .export({
      type: 'pkcs8',
      format: 'pem',
    })
    .toString();
}

async function getSigningKey() {
  if (!signingKeyPromise) {
    signingKeyPromise = importPKCS8(
      normalizePrivateKey(getGitHubAppPrivateKey()),
      'RS256'
    );
  }

  return signingKeyPromise;
}

export async function generateGitHubAppJwt() {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setIssuer(getGitHubAppId())
    .setExpirationTime('9m')
    .sign(await getSigningKey());
}

export async function getGitHubAppMetadata() {
  if (!appMetadataPromise) {
    appMetadataPromise = githubJsonRequest<GitHubAppMetadata>('/app', {
      token: await generateGitHubAppJwt(),
    });
  }

  return appMetadataPromise;
}

export async function getGitHubInstallationDetails(
  installationId: string
): Promise<GitHubInstallationDetails> {
  return githubJsonRequest<GitHubInstallationDetails>(
    `/app/installations/${installationId}`,
    {
      token: await generateGitHubAppJwt(),
    }
  );
}

export async function createGitHubInstallationAccessToken(
  installationId: string
) {
  const response = await githubJsonRequest<GitHubInstallationAccessTokenResponse>(
    `/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      token: await generateGitHubAppJwt(),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );

  return response.token;
}

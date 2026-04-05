// Signs and verifies short-lived GitHub integration state and verification tokens.
import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import type { GithubSetupAction } from '@/lib/types/githubIntegrationTypes';
import { UnauthorizedError } from '@/lib/utils/apiErrors';

const GITHUB_STATE_AUDIENCE = 'github-integration';
const GITHUB_STATE_ISSUER = 'axxon';

type GitHubTokenPurpose =
  | 'github_install_state'
  | 'github_callback_state'
  | 'github_verification';

type ParsedGitHubStateClaims = JWTPayload & {
  purpose?: GitHubTokenPurpose;
  organizationId?: number;
  userId?: number;
  installationId?: string;
  setupAction?: string | null;
  installState?: string;
  githubUserId?: string;
  githubUserLogin?: string;
  nonce?: string;
};

type GitHubJwtOptions = {
  expiresIn: string;
  purpose: GitHubTokenPurpose;
} & Record<string, string | number | null | undefined>;

function getGitHubStateSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return new TextEncoder().encode(secret);
}

function normalizeNumericClaim(value: unknown, label: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new UnauthorizedError(`Invalid ${label}`);
  }

  return parsedValue;
}

function normalizeStringClaim(value: unknown, label: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new UnauthorizedError(`Invalid ${label}`);
  }

  return value;
}

function normalizeSetupAction(value: unknown): GithubSetupAction {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value === 'install' || value === 'update') {
    return value;
  }

  throw new UnauthorizedError('Invalid setup action');
}

async function signGitHubJwt(options: GitHubJwtOptions) {
  const { expiresIn, purpose, ...claims } = options;

  return new SignJWT({
    ...claims,
    purpose,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(GITHUB_STATE_ISSUER)
    .setAudience(GITHUB_STATE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getGitHubStateSecret());
}

async function verifyGitHubJwt<T extends GitHubTokenPurpose>(
  token: string,
  purpose: T
) {
  try {
    const { payload } = await jwtVerify(token, getGitHubStateSecret(), {
      algorithms: ['HS256'],
      issuer: GITHUB_STATE_ISSUER,
      audience: GITHUB_STATE_AUDIENCE,
    });

    const claims = payload as ParsedGitHubStateClaims;

    if (claims.purpose !== purpose) {
      throw new UnauthorizedError('Invalid GitHub integration token');
    }

    return claims;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    throw new UnauthorizedError('Invalid or expired GitHub integration token');
  }
}

export async function createGitHubInstallStateToken({
  organizationId,
  userId,
}: {
  organizationId: number;
  userId: number;
}) {
  return signGitHubJwt({
    // The installation handoff can include GitHub org approval or account switching.
    // Keep the initial install state long enough to survive that round-trip.
    expiresIn: '1h',
    purpose: 'github_install_state',
    organizationId,
    userId,
    nonce: randomUUID(),
  });
}

export async function verifyGitHubInstallStateToken(token: string) {
  const claims = await verifyGitHubJwt(token, 'github_install_state');

  return {
    organizationId: normalizeNumericClaim(claims.organizationId, 'organization id'),
    userId: normalizeNumericClaim(claims.userId, 'user id'),
    nonce: normalizeStringClaim(claims.nonce, 'nonce'),
  };
}

export async function createGitHubCallbackStateToken({
  organizationId,
  userId,
  installationId,
  setupAction,
  installState,
}: {
  organizationId: number;
  userId: number;
  installationId: string;
  setupAction: GithubSetupAction;
  installState: string;
}) {
  return signGitHubJwt({
    expiresIn: '10m',
    purpose: 'github_callback_state',
    organizationId,
    userId,
    installationId,
    setupAction,
    installState,
    nonce: randomUUID(),
  });
}

export async function verifyGitHubCallbackStateToken(token: string) {
  const claims = await verifyGitHubJwt(token, 'github_callback_state');

  return {
    organizationId: normalizeNumericClaim(claims.organizationId, 'organization id'),
    userId: normalizeNumericClaim(claims.userId, 'user id'),
    installationId: normalizeStringClaim(claims.installationId, 'installation id'),
    setupAction: normalizeSetupAction(claims.setupAction),
    installState: normalizeStringClaim(claims.installState, 'install state'),
    nonce: normalizeStringClaim(claims.nonce, 'nonce'),
  };
}

export async function createGitHubVerificationToken({
  organizationId,
  userId,
  installationId,
  githubUserId,
  githubUserLogin,
}: {
  organizationId: number;
  userId: number;
  installationId: string;
  githubUserId: string;
  githubUserLogin: string;
}) {
  return signGitHubJwt({
    expiresIn: '10m',
    purpose: 'github_verification',
    organizationId,
    userId,
    installationId,
    githubUserId,
    githubUserLogin,
  });
}

export async function verifyGitHubVerificationToken(token: string) {
  const claims = await verifyGitHubJwt(token, 'github_verification');

  return {
    organizationId: normalizeNumericClaim(claims.organizationId, 'organization id'),
    userId: normalizeNumericClaim(claims.userId, 'user id'),
    installationId: normalizeStringClaim(claims.installationId, 'installation id'),
    githubUserId: normalizeStringClaim(claims.githubUserId, 'GitHub user id'),
    githubUserLogin: normalizeStringClaim(claims.githubUserLogin, 'GitHub user login'),
  };
}

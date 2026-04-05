// Validates org-scoped GitHub integration requests and routes them to service-layer workflows.
import { z } from 'zod';
import {
  buildGitHubInstallationStart,
  finalizeGitHubInstallation,
  getRepositoriesForOrganization,
  handleGitHubAuthorizationCallback,
  syncGitHubRepositoriesForOrganization,
} from '@/lib/integrations/github/service';
import { handleGitHubWebhookRequest } from '@/lib/integrations/github/webhookService';
import {
  requireOrganizationMember,
  requireOrganizationOwner,
} from '@/lib/utils/authorization';
import { BadRequestError } from '@/lib/utils/apiErrors';

const finalizeGitHubInstallationSchema = z.object({
  installationId: z.string().trim().min(1),
  setupAction: z.enum(['install', 'update']).nullable().optional(),
  state: z.string().trim().min(1),
  verificationToken: z.string().trim().min(1).optional(),
});

function assertOrganizationId(organizationId: number) {
  if (!Number.isFinite(organizationId)) {
    throw new BadRequestError('Invalid organization id');
  }
}

export async function startOrganizationGitHubInstall({
  organizationId,
  sessionUserId,
}: {
  organizationId: number;
  sessionUserId: number;
}) {
  assertOrganizationId(organizationId);
  await requireOrganizationOwner(organizationId, sessionUserId);

  return buildGitHubInstallationStart({
    organizationId,
    userId: sessionUserId,
  });
}

export async function finalizeOrganizationGitHubInstall({
  organizationId,
  sessionUserId,
  data,
}: {
  organizationId: number;
  sessionUserId: number;
  data: unknown;
}) {
  assertOrganizationId(organizationId);
  await requireOrganizationOwner(organizationId, sessionUserId);

  const parsedData = finalizeGitHubInstallationSchema.safeParse(data);

  if (!parsedData.success) {
    throw new BadRequestError('Invalid GitHub finalize payload');
  }

  return finalizeGitHubInstallation({
    organizationId,
    userId: sessionUserId,
    installationId: parsedData.data.installationId,
    setupAction: parsedData.data.setupAction ?? null,
    state: parsedData.data.state,
    verificationToken: parsedData.data.verificationToken,
  });
}

export async function syncOrganizationGitHubRepositories({
  organizationId,
  sessionUserId,
}: {
  organizationId: number;
  sessionUserId: number;
}) {
  assertOrganizationId(organizationId);
  await requireOrganizationOwner(organizationId, sessionUserId);

  return syncGitHubRepositoriesForOrganization({
    organizationId,
  });
}

export async function listOrganizationRepositories({
  organizationId,
  sessionUserId,
}: {
  organizationId: number;
  sessionUserId: number;
}) {
  assertOrganizationId(organizationId);
  await requireOrganizationMember(organizationId, sessionUserId);

  return getRepositoriesForOrganization({
    organizationId,
  });
}

export async function resolveGitHubAuthorizationCallbackRedirect({
  code,
  state,
  error,
}: {
  code?: string | null;
  state?: string | null;
  error?: string | null;
}) {
  return handleGitHubAuthorizationCallback({
    code,
    state,
    error,
  });
}

export async function processGitHubWebhook({
  rawBody,
  headers,
}: {
  rawBody: string;
  headers: Headers;
}) {
  return handleGitHubWebhookRequest({
    rawBody,
    headers,
  });
}

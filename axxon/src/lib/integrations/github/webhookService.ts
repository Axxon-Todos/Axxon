// Persists GitHub webhook deliveries and applies installation and repository side effects.
import { GithubInstallations } from '@/lib/models/githubInstallations';
import { GithubWebhookEvents } from '@/lib/models/githubWebhookEvents';
import { Repositories } from '@/lib/models/repositories';
import {
  extractGitHubWebhookHeaders,
  parseGitHubWebhookPayload,
  verifyGitHubWebhookSignature,
} from '@/lib/github/webhooks';
import { syncRepositoriesForInstallation } from '@/lib/integrations/github/repositorySync';

type GitHubWebhookPayload = {
  action?: string;
  installation?: {
    id?: number | string;
  };
  repository?: {
    id?: number | string;
  };
};

type GitHubWebhookHandleResult = {
  duplicate: boolean;
  processed: boolean;
};

function asError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function normalizeGithubId(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  return String(value);
}

async function processInstallationEvent({
  action,
  githubInstallationId,
}: {
  action: string | null;
  githubInstallationId: string | null;
}) {
  if (!action || !githubInstallationId) {
    return 'ignored' as const;
  }

  const installation = await GithubInstallations.getByGithubInstallationId(
    githubInstallationId
  );

  if (!installation) {
    return 'ignored' as const;
  }

  if (action === 'created' || action === 'unsuspend') {
    await GithubInstallations.updateStatusByGithubInstallationId(
      githubInstallationId,
      'active'
    );
    return 'processed' as const;
  }

  if (action === 'suspend') {
    await GithubInstallations.updateStatusByGithubInstallationId(
      githubInstallationId,
      'suspended'
    );
    return 'processed' as const;
  }

  if (action === 'deleted') {
    await GithubInstallations.updateStatusByGithubInstallationId(
      githubInstallationId,
      'removed'
    );
    await Repositories.deactivateAllForInstallation({
      organizationId: installation.organization_id,
      githubInstallationId,
    });
    return 'processed' as const;
  }

  return 'ignored' as const;
}

async function processInstallationRepositoriesEvent(
  githubInstallationId: string | null
) {
  if (!githubInstallationId) {
    return 'ignored' as const;
  }

  const installation = await GithubInstallations.getByGithubInstallationId(
    githubInstallationId
  );

  if (!installation || installation.status !== 'active') {
    return 'ignored' as const;
  }

  await syncRepositoriesForInstallation({
    organizationId: installation.organization_id,
    githubInstallationId,
  });

  return 'processed' as const;
}

export async function handleGitHubWebhookRequest({
  rawBody,
  headers,
}: {
  rawBody: string;
  headers: Headers;
}): Promise<GitHubWebhookHandleResult> {
  const webhookHeaders = extractGitHubWebhookHeaders(headers);

  verifyGitHubWebhookSignature({
    rawBody,
    signature256: webhookHeaders.signature256,
  });

  const payload = parseGitHubWebhookPayload(rawBody) as GitHubWebhookPayload;
  const action = payload.action ?? null;
  const githubInstallationId = normalizeGithubId(payload.installation?.id);
  const githubRepositoryId = normalizeGithubId(payload.repository?.id);
  const persistedEvent = await GithubWebhookEvents.createIfNotExists({
    github_delivery_id: webhookHeaders.deliveryId,
    event_name: webhookHeaders.eventName,
    action,
    github_installation_id: githubInstallationId,
    github_repository_id: githubRepositoryId,
    signature_256: webhookHeaders.signature256,
    payload_json: payload as Record<string, unknown>,
    headers_json: webhookHeaders.headersJson,
  });

  if (!persistedEvent.inserted) {
    return {
      duplicate: true,
      processed: false,
    };
  }

  try {
    let status: 'processed' | 'ignored' = 'ignored';

    if (webhookHeaders.eventName === 'installation') {
      status = await processInstallationEvent({
        action,
        githubInstallationId,
      });
    } else if (webhookHeaders.eventName === 'installation_repositories') {
      status = await processInstallationRepositoriesEvent(githubInstallationId);
    }

    await GithubWebhookEvents.markStatus({
      id: persistedEvent.event.id,
      status,
    });

    return {
      duplicate: false,
      processed: status === 'processed',
    };
  } catch (error) {
    await GithubWebhookEvents.markStatus({
      id: persistedEvent.event.id,
      status: 'failed',
      errorMessage: asError(error).message,
      incrementRetry: true,
    });

    throw error;
  }
}

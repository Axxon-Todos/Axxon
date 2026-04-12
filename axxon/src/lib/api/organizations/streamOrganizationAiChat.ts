// Starts an org-scoped AI chat request and returns the raw response stream for incremental UI updates.
import { apiFetch } from '@/lib/api/apiFetch';
import type { OrganizationAiChatRequest } from '@/lib/types/organizationAiChatTypes';
import { buildOrganizationAiChatApiPath } from '@/lib/utils/routes';

// Keep the frontend API helper thin so the streaming behavior stays owned by the workspace component.
export function streamOrganizationAiChat({
  organizationId,
  threadId,
  content,
  signal,
}: {
  organizationId: string | number;
  threadId?: number;
  content: string;
  signal?: AbortSignal;
}) {
  const request: OrganizationAiChatRequest = {
    content,
  };

  if (typeof threadId === 'number') {
    request.threadId = threadId;
  }

  return apiFetch(buildOrganizationAiChatApiPath(organizationId), {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
}

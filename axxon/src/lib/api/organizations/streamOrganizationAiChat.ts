// Starts an org-scoped AI chat request and returns the raw response stream for incremental UI updates.
import { apiFetch } from '@/lib/api/apiFetch';
import type { AiChatMessage } from '@/lib/types/aiTypes';
import { buildOrganizationAiChatApiPath } from '@/lib/utils/routes';

// Keep the frontend API helper thin so the streaming behavior stays owned by the workspace component.
export function streamOrganizationAiChat({
  organizationId,
  messages,
  signal,
}: {
  organizationId: string | number;
  messages: AiChatMessage[];
  signal?: AbortSignal;
}) {
  return apiFetch(buildOrganizationAiChatApiPath(organizationId), {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
    }),
  });
}

// Fetches one persisted org AI chat thread and its ordered transcript messages.
import { apiFetch } from '@/lib/api/apiFetch';
import type { OrganizationAiChatThreadDetail } from '@/lib/types/organizationAiChatTypes';
import { buildOrganizationAiThreadApiPath } from '@/lib/utils/routes';

export async function fetchOrganizationAiThread(
  organizationId: string,
  threadId: number
): Promise<OrganizationAiChatThreadDetail> {
  const response = await apiFetch(
    buildOrganizationAiThreadApiPath(organizationId, threadId),
    {
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch AI chat thread');
  }

  return response.json();
}

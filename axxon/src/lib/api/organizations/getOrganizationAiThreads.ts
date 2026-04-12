// Fetches the current member's persisted org AI chat thread list for sidebar rendering.
import { apiFetch } from '@/lib/api/apiFetch';
import type { OrganizationAiChatThread } from '@/lib/types/organizationAiChatTypes';
import { buildOrganizationAiThreadsApiPath } from '@/lib/utils/routes';

export async function fetchOrganizationAiThreads(
  organizationId: string
): Promise<OrganizationAiChatThread[]> {
  const response = await apiFetch(buildOrganizationAiThreadsApiPath(organizationId), {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch AI chat threads');
  }

  return response.json();
}

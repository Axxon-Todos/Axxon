import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardsApiPath } from '@/lib/utils/routes';

export async function fetchBoards(organizationId: string): Promise<any[]> {
  const res = await apiFetch(buildOrganizationBoardsApiPath(organizationId), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch boards');
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.boards ?? [];
}

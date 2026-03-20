import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';
import type { User } from '@/lib/types/users';

export async function fetchBoardMembers(
  organizationId: string,
  boardId: string
): Promise<User[]> {
  const response = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, '/member'),
    {
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch board members');
  }

  return response.json();
}

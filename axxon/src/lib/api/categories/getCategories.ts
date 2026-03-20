import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function fetchCategories(organizationId: string, boardId: string) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, '/categories'),
    {
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error('Failed to fetch categories');
  }

  return res.json();
}

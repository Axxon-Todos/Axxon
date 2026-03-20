import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function reorderCategories(
  organizationId: string | number,
  boardId: string | number,
  newOrder: string[]
) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, '/categories/reorder'),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newOrder }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to reorder categories: ${res.statusText}`);
  }

  return res.json();
}

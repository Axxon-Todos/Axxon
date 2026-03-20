import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function deleteCategoryById(
  organizationId: string | number,
  boardId: string | number,
  categoryId: string | number
) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(
      organizationId,
      boardId,
      `/categories/${categoryId}`
    ),
    {
      method: 'DELETE',
    }
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || 'Failed to delete category');
  }

  return res.json();
}

import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function updateCategoryById(
  organizationId: string | number,
  boardId: string | number,
  categoryId: number,
  data: Partial<{
    name?: string;
    color?: string;
    position?: number;
    is_done?: boolean;
  }>
) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(
      organizationId,
      boardId,
      `/categories/${categoryId}`
    ),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update category');
  }

  return res.json();
}

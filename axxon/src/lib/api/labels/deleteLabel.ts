import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function deleteLabel(
  organizationId: string | number,
  boardId: string | number,
  labelId: number
) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, `/labels/${labelId}`),
    {
      method: 'DELETE',
    }
  );

  if (!res.ok) {
    throw new Error('Failed to delete label');
  }

  return res.json();
}

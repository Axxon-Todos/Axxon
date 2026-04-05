import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function deleteBoardById(
  organizationId: string | number,
  id: string
) {
  const res = await apiFetch(buildOrganizationBoardApiPath(organizationId, id), {
    method: 'DELETE',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || 'Failed to delete board');
  }

  return res.json();
}

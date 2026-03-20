import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function updateBoardById(
  organizationId: string | number,
  id: string,
  data: { name?: string; color?: string }
) {
  const res = await apiFetch(buildOrganizationBoardApiPath(organizationId, id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update board');
  return res.json();
}

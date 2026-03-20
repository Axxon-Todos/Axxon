import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function updateLabel(
  organizationId: string | number,
  boardId: string | number,
  labelId: number,
  data: { name?: string; color?: string }
) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, `/labels/${labelId}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    throw new Error('Failed to update label');
  }

  return res.json();
}

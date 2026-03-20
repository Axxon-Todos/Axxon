import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function createLabel(
  organizationId: string | number,
  boardId: string | number,
  data: { name: string; color?: string }
) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, '/labels'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    throw new Error('Failed to create label');
  }

  return res.json();
}

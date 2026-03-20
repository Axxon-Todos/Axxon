import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function fetchBoard(organizationId: string, boardId: string) {
  const res = await apiFetch(buildOrganizationBoardApiPath(organizationId, boardId))
  if (!res.ok) {
    throw new Error('Failed to fetch board')
  }

  const data = await res.json()

  // Ensure it doesn't return undefined
  return data ?? null
}

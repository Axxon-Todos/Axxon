import { apiFetch } from '@/lib/api/apiFetch';
import type { CreateSprintData, SprintBaseData } from '@/lib/types/sprintTypes';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export type NewSprintInput = Omit<CreateSprintData, 'board_id'>;

export async function createSprint(
  organizationId: string | number,
  boardId: number,
  data: NewSprintInput
): Promise<SprintBaseData> {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, '/sprints'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || 'Failed to create sprint');
  }

  return res.json();
}

import { apiFetch } from '@/lib/api/apiFetch';
import type { SprintBaseData, UpdateSprintData } from '@/lib/types/sprintTypes';

export type UpdateSprintInput = Partial<
  Pick<UpdateSprintData, 'name' | 'description' | 'start_date' | 'end_date' | 'color' | 'icon' | 'archived_at'>
>;

export async function updateSprint(
  boardId: string | number,
  sprintId: string | number,
  data: UpdateSprintInput
): Promise<SprintBaseData> {
  const res = await apiFetch(`/api/board/${boardId}/sprints/${sprintId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || 'Failed to update sprint');
  }

  return res.json();
}

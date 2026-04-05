import dayjs from 'dayjs';
import type { SprintBaseData } from '@/lib/types/sprintTypes';

export type SprintStatus = 'planned' | 'active' | 'completed' | 'archived';

export function getSprintStatus(sprint: Pick<SprintBaseData, 'start_date' | 'end_date' | 'archived_at'>): SprintStatus {
  if (sprint.archived_at) {
    return 'archived';
  }

  const today = dayjs();

  if (today.isBefore(dayjs(sprint.start_date), 'day')) {
    return 'planned';
  }

  if (today.isAfter(dayjs(sprint.end_date), 'day')) {
    return 'completed';
  }

  return 'active';
}

export function getSprintStatusLabel(status: SprintStatus) {
  switch (status) {
    case 'planned':
      return 'Planned';
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    case 'archived':
      return 'Archived';
    default:
      return 'Active';
  }
}

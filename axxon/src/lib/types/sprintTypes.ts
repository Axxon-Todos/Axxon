export const SPRINT_ICON_OPTIONS = [
  'flag',
  'rocket',
  'target',
  'sparkles',
  'brain',
  'flame',
] as const;

export type SprintIcon = (typeof SPRINT_ICON_OPTIONS)[number];

export type SprintBaseData = {
  id: number;
  board_id: number;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  color: string | null;
  icon: SprintIcon | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSprintData = Pick<
  SprintBaseData,
  'board_id' | 'name' | 'description' | 'start_date' | 'end_date' | 'color' | 'icon'
>;

export type UpdateSprintData = Pick<SprintBaseData, 'id' | 'board_id'> &
  Partial<
    Pick<
      SprintBaseData,
      'name' | 'description' | 'start_date' | 'end_date' | 'color' | 'icon' | 'archived_at'
    >
  >;

export type ListSprintsData = Pick<SprintBaseData, 'board_id'>;
export type GetSprintByIdData = Pick<SprintBaseData, 'id' | 'board_id'>;

export type SprintSummary = Pick<SprintBaseData, 'id' | 'name' | 'color' | 'icon' | 'archived_at'>;

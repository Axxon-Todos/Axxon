export type OrganizationBaseData = {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

export type OrganizationCreation = Pick<
  OrganizationBaseData,
  'name' | 'description' | 'color' | 'created_by'
>;

export type OrganizationSummary = OrganizationBaseData & {
  member_count: number;
  accessible_board_count: number;
  repo_count: number;
};

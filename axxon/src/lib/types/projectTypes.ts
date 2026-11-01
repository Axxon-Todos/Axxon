// Defines project records and mutations for the organization-owned architecture workspace.
export type ProjectBaseData = {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

export type ProjectCreation = Pick<ProjectBaseData, 'organization_id' | 'name' | 'description' | 'created_by'>;

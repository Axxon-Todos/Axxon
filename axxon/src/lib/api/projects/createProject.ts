// Creates an organization-owned architecture project.
import { apiFetch } from '@/lib/api/apiFetch';
import type { ProjectBaseData } from '@/lib/types/projectTypes';
import { buildOrganizationProjectsApiPath } from '@/lib/utils/routes';

export async function createProject(organizationId: string, data: { name: string; description?: string }) {
  const response = await apiFetch(buildOrganizationProjectsApiPath(organizationId), { method: 'POST', body: JSON.stringify(data) });
  if (!response.ok) throw new Error('Failed to create project');
  return response.json() as Promise<ProjectBaseData>;
}

// Fetches architecture projects owned by an organization.
import { apiFetch } from '@/lib/api/apiFetch';
import type { ProjectBaseData } from '@/lib/types/projectTypes';
import { buildOrganizationProjectsApiPath } from '@/lib/utils/routes';

export async function fetchProjects(organizationId: string): Promise<ProjectBaseData[]> {
  const response = await apiFetch(buildOrganizationProjectsApiPath(organizationId), { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch projects');
  return response.json();
}

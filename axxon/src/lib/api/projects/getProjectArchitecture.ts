// Fetches the canonical project graph, draft state, and revision history.
import { apiFetch } from '@/lib/api/apiFetch';
import type { ArchitectureGraph, ArchitectureRevision } from '@/lib/types/architectureTypes';
import type { ProjectBaseData } from '@/lib/types/projectTypes';
import { buildOrganizationProjectApiPath } from '@/lib/utils/routes';

export type ProjectArchitectureResponse = {
  project: ProjectBaseData;
  graph: ArchitectureGraph;
  revisions: ArchitectureRevision[];
};

export async function fetchProjectArchitecture(organizationId: string, projectId: string) {
  const response = await apiFetch(buildOrganizationProjectApiPath(organizationId, projectId, '/architecture'), { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch architecture');
  return response.json() as Promise<ProjectArchitectureResponse>;
}

export async function saveProjectArchitecture(organizationId: string, projectId: string, data: unknown) {
  const response = await apiFetch(buildOrganizationProjectApiPath(organizationId, projectId, '/architecture'), { method: 'PATCH', body: JSON.stringify(data) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to save architecture');
  return response.json() as Promise<ArchitectureGraph>;
}

export async function commitProjectArchitecture(organizationId: string, projectId: string, summary?: string) {
  const response = await apiFetch(buildOrganizationProjectApiPath(organizationId, projectId, '/architecture'), { method: 'POST', body: JSON.stringify({ summary }) });
  if (!response.ok) throw new Error('Failed to commit architecture');
  return response.json() as Promise<ArchitectureRevision>;
}

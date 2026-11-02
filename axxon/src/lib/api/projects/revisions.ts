// Provides client calls for semantic architecture revision review and rollback.
import { apiFetch } from '@/lib/api/apiFetch';
import type { ArchitectureRevision } from '@/lib/types/architectureTypes';
import type { ArchitectureRevisionDiff } from '@/lib/utils/architectureRevisionDiff';
import { buildOrganizationProjectApiPath } from '@/lib/utils/routes';

export type ArchitectureRevisionComparison = {
  from: Omit<ArchitectureRevision, 'snapshot_json'>;
  to: Omit<ArchitectureRevision, 'snapshot_json'>;
  diff: ArchitectureRevisionDiff;
};

// Fetches a revision, or compares it against another revision when compareTo is provided.
export async function fetchProjectRevision(organizationId: string, projectId: string, revisionId: number, compareTo?: number) {
  const query = compareTo ? `?compareTo=${compareTo}` : '';
  const response = await apiFetch(`${buildOrganizationProjectApiPath(organizationId, projectId, '/architecture/revisions')}/${revisionId}${query}`, { cache: 'no-store' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to fetch architecture revision');
  return response.json() as Promise<ArchitectureRevision | ArchitectureRevisionComparison>;
}

// Creates a new immutable revision restoring the selected historical snapshot.
export async function revertProjectRevision(organizationId: string, projectId: string, revisionId: number) {
  const response = await apiFetch(`${buildOrganizationProjectApiPath(organizationId, projectId, '/architecture/revisions')}/${revisionId}/revert`, { method: 'POST' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to revert architecture revision');
  return response.json() as Promise<ArchitectureRevision>;
}

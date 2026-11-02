// Provides project-scoped client calls for architecture discussions and event replay.
import { apiFetch } from '@/lib/api/apiFetch';
import type { ArchitectureCollaborationEvent, ArchitectureComment, ArchitectureCommentThread } from '@/lib/types/architectureCollaborationTypes';
import { buildOrganizationProjectApiPath } from '@/lib/utils/routes';

function collaborationPath(organizationId: string, projectId: string, suffix = '') {
  return buildOrganizationProjectApiPath(organizationId, projectId, `/collaboration${suffix}`);
}

// Fetches comment threads anchored to the project architecture.
export async function fetchArchitectureThreads(organizationId: string, projectId: string, status?: 'open' | 'resolved') {
  const query = status ? `?status=${status}` : '';
  const response = await apiFetch(`${collaborationPath(organizationId, projectId, '/threads')}${query}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch architecture discussions');
  return response.json() as Promise<ArchitectureCommentThread[]>;
}

// Creates a component or relationship anchored discussion and optionally starts @Axxon.
export async function createArchitectureThread(organizationId: string, projectId: string, input: { body: string; componentId?: string; relationshipId?: string; revisionId?: number; proposalRunId?: number }) {
  const response = await apiFetch(collaborationPath(organizationId, projectId, '/threads'), { method: 'POST', body: JSON.stringify(input) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to create discussion');
  return response.json() as Promise<ArchitectureCommentThread & { agentRun?: { id: number } | null }>;
}

// Adds a reply and starts @Axxon when the reply addresses the agent.
export async function addArchitectureComment(organizationId: string, projectId: string, threadId: number, body: string) {
  const response = await apiFetch(collaborationPath(organizationId, projectId, `/threads/${threadId}/comments`), { method: 'POST', body: JSON.stringify({ body }) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to reply to discussion');
  return response.json() as Promise<{ comment: ArchitectureComment; agentRun?: { id: number } | null }>;
}

// Resolves or reopens a discussion without deleting its history.
export async function setArchitectureThreadResolved(organizationId: string, projectId: string, threadId: number, resolved: boolean) {
  const response = await apiFetch(collaborationPath(organizationId, projectId, `/threads/${threadId}`), { method: 'PATCH', body: JSON.stringify({ resolved }) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to update discussion');
  return response.json() as Promise<ArchitectureCommentThread>;
}

// Fetches missed collaboration events after a reconnect cursor.
export async function fetchArchitectureCollaborationEvents(organizationId: string, projectId: string, afterId: number) {
  const response = await apiFetch(`${collaborationPath(organizationId, projectId, '/events')}?afterId=${afterId}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch collaboration events');
  return response.json() as Promise<ArchitectureCollaborationEvent[]>;
}

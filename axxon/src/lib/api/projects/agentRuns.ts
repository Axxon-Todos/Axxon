// Provides the project-scoped client calls used to start and inspect architecture-agent runs.
import { apiFetch } from '@/lib/api/apiFetch';
import type { AgentRun } from '@/lib/types/agentTypes';
import type { AgentClarificationAnswer } from '@/lib/types/agentTypes';
import { buildOrganizationProjectApiPath } from '@/lib/utils/routes';

export async function fetchProjectAgentRuns(organizationId: string, projectId: string) {
  const response = await apiFetch(buildOrganizationProjectApiPath(organizationId, projectId, '/agent-runs'), { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch project agent runs');
  return response.json() as Promise<AgentRun[]>;
}

// Fetches the immutable change set used to render an architecture review preview.
export async function fetchProjectAgentRunDetail(organizationId: string, projectId: string, runId: number) {
  const response = await apiFetch(`${buildOrganizationProjectApiPath(organizationId, projectId, '/agent-runs')}/${runId}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch project agent run detail');
  return response.json() as Promise<{ run: AgentRun; changeSet: { base_revision_id: number; operations_json: unknown; proposed_graph_json: unknown } | null }>;
}

export async function createProjectAgentRun(organizationId: string, projectId: string, prompt: string) {
  const response = await apiFetch(buildOrganizationProjectApiPath(organizationId, projectId, '/agent-runs'), {
    method: 'POST',
    body: JSON.stringify({ prompt, intent: 'bootstrap' }),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to start architecture agent');
  return response.json() as Promise<AgentRun>;
}

// Approves a reviewable project proposal and returns its new canonical revision.
export async function approveProjectAgentRun(organizationId: string, projectId: string, runId: number) {
  const response = await apiFetch(`${buildOrganizationProjectApiPath(organizationId, projectId, '/agent-runs')}/${runId}/approve`, { method: 'POST' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to approve architecture proposal');
  return response.json() as Promise<{ updatedRun: AgentRun; revision: { id: number; version: number } }>;
}

// Sends reviewer feedback back into the architecture planning loop.
export async function requestProjectAgentChanges(organizationId: string, projectId: string, runId: number, feedback: string) {
  const response = await apiFetch(`${buildOrganizationProjectApiPath(organizationId, projectId, '/agent-runs')}/${runId}/changes`, { method: 'POST', body: JSON.stringify({ feedback }) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to request architecture changes');
  return response.json() as Promise<AgentRun>;
}

// Submits the plain-language discovery answers that unblock an architecture run.
export async function submitProjectAgentDiscoveryAnswers(organizationId: string, projectId: string, runId: number, answers: AgentClarificationAnswer[]) {
  const response = await apiFetch(`${buildOrganizationProjectApiPath(organizationId, projectId, '/agent-runs')}/${runId}/input`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to submit discovery answers');
  return response.json() as Promise<AgentRun>;
}

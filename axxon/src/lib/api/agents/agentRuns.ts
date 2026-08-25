// Wraps org- and board-scoped agent-run API calls for the planning workspace.
import { apiFetch } from '@/lib/api/apiFetch';
import { readApiError } from '@/lib/api/readApiError';
import type { AgentClarificationAnswer, AgentRun, AgentRunDetail } from '@/lib/types/agentTypes';
import {
  buildOrganizationBoardAgentRunApiPath,
  buildOrganizationBoardAgentRunsApiPath,
} from '@/lib/utils/routes';

async function parseAgentResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(await readApiError(response, fallbackMessage));
  }

  return response.json() as Promise<T>;
}

export async function fetchAgentRuns(organizationId: string, boardId: string) {
  const response = await apiFetch(buildOrganizationBoardAgentRunsApiPath(organizationId, boardId), {
    method: 'GET',
    cache: 'no-store',
  });

  return parseAgentResponse<AgentRun[]>(response, 'Failed to load agent runs');
}

export async function fetchAgentRunDetail(organizationId: string, boardId: string, runId: number) {
  const response = await apiFetch(buildOrganizationBoardAgentRunApiPath(organizationId, boardId, runId), {
    method: 'GET',
    cache: 'no-store',
  });

  return parseAgentResponse<AgentRunDetail>(response, 'Failed to load agent run');
}

export async function createPlanningAgentRun(organizationId: string, boardId: string, prompt: string) {
  const response = await apiFetch(buildOrganizationBoardAgentRunsApiPath(organizationId, boardId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, runType: 'planning' }),
  });

  return parseAgentResponse<AgentRunDetail>(response, 'Failed to create planning run');
}

export async function submitAgentRunInput(
  organizationId: string,
  boardId: string,
  runId: number,
  answers: AgentClarificationAnswer[]
) {
  const response = await apiFetch(buildOrganizationBoardAgentRunApiPath(organizationId, boardId, runId, '/input'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });

  return parseAgentResponse<AgentRunDetail>(response, 'Failed to submit agent input');
}

export async function submitAgentRunMessage(organizationId: string, boardId: string, runId: number, message: string) {
  const response = await apiFetch(buildOrganizationBoardAgentRunApiPath(organizationId, boardId, runId, '/message'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  return parseAgentResponse<AgentRunDetail>(response, 'Failed to submit agent message');
}

export async function requestAgentRunChanges(organizationId: string, boardId: string, runId: number, feedback: string) {
  const response = await apiFetch(buildOrganizationBoardAgentRunApiPath(organizationId, boardId, runId, '/changes'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback }),
  });

  return parseAgentResponse<AgentRunDetail>(response, 'Failed to request agent changes');
}

export async function approveAgentRunPlan(organizationId: string, boardId: string, runId: number) {
  const response = await apiFetch(buildOrganizationBoardAgentRunApiPath(organizationId, boardId, runId, '/approve'), {
    method: 'POST',
  });

  return parseAgentResponse<AgentRunDetail>(response, 'Failed to approve agent plan');
}

export async function cancelAgentRun(organizationId: string, boardId: string, runId: number) {
  const response = await apiFetch(buildOrganizationBoardAgentRunApiPath(organizationId, boardId, runId, '/cancel'), {
    method: 'POST',
  });

  return parseAgentResponse<AgentRunDetail>(response, 'Failed to cancel agent run');
}

export async function retryAgentRun(organizationId: string, boardId: string, runId: number) {
  const response = await apiFetch(buildOrganizationBoardAgentRunApiPath(organizationId, boardId, runId, '/retry'), {
    method: 'POST',
  });

  return parseAgentResponse<AgentRunDetail>(response, 'Failed to retry agent run');
}

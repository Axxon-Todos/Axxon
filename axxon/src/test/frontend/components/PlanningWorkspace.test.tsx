// Verifies the org AI planning workspace creates runs and submits structured clarification answers.
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedApproveAgentRunPlan,
  mockedCancelAgentRun,
  mockedCreatePlanningAgentRun,
  mockedFetchAgentRunDetail,
  mockedFetchAgentRuns,
  mockedFetchBoards,
  mockedRequestAgentRunChanges,
  mockedRetryAgentRun,
  mockedSubmitAgentRunInput,
  mockedUseAgentRunsRealtime,
  mockedUseSocket,
} = vi.hoisted(() => ({
  mockedApproveAgentRunPlan: vi.fn(),
  mockedCancelAgentRun: vi.fn(),
  mockedCreatePlanningAgentRun: vi.fn(),
  mockedFetchAgentRunDetail: vi.fn(),
  mockedFetchAgentRuns: vi.fn(),
  mockedFetchBoards: vi.fn(),
  mockedRequestAgentRunChanges: vi.fn(),
  mockedRetryAgentRun: vi.fn(),
  mockedSubmitAgentRunInput: vi.fn(),
  mockedUseAgentRunsRealtime: vi.fn(),
  mockedUseSocket: vi.fn(),
}));

vi.mock('@/lib/api/agents/agentRuns', () => ({
  approveAgentRunPlan: mockedApproveAgentRunPlan,
  cancelAgentRun: mockedCancelAgentRun,
  createPlanningAgentRun: mockedCreatePlanningAgentRun,
  fetchAgentRunDetail: mockedFetchAgentRunDetail,
  fetchAgentRuns: mockedFetchAgentRuns,
  requestAgentRunChanges: mockedRequestAgentRunChanges,
  retryAgentRun: mockedRetryAgentRun,
  submitAgentRunInput: mockedSubmitAgentRunInput,
}));

vi.mock('@/lib/api/boards/getBoards', () => ({
  fetchBoards: mockedFetchBoards,
}));

vi.mock('@/hooks/useAgentRunsRealtime', () => ({
  useAgentRunsRealtime: mockedUseAgentRunsRealtime,
}));

vi.mock('@/hooks/useSocket', () => ({
  useSocket: mockedUseSocket,
}));

import PlanningWorkspace from '@/components/features/agents/PlanningWorkspace';
import type { AgentRunDetail } from '@/lib/types/agentTypes';
import { renderWithProviders } from '../renderWithProviders';

const board = {
  id: '5',
  name: 'Platform Board',
  organization_id: 12,
  created_by: 7,
  color: '#2563eb',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function createRun(overrides: Partial<AgentRunDetail> = {}): AgentRunDetail {
  return {
    id: 44,
    organizationId: 12,
    boardId: 5,
    createdBy: 7,
    runType: 'planning',
    title: 'Plan the agent UI',
    prompt: 'Build a planning UI',
    state: 'awaiting_input',
    version: 2,
    questions: [{
      questionKey: 'success-bar',
      category: 'acceptance_criteria',
      prompt: 'What should count as success?',
      whyThisMatters: 'The plan needs a clear acceptance bar.',
      required: true,
      blocking: true,
      options: [
        { optionKey: 'demo', label: 'End-to-end demo', description: 'Prove the full prompt-to-plan flow.', isRecommended: true },
        { optionKey: 'hardened', label: 'Production ready', description: 'Require hardened behavior.' },
        { optionKey: 'prototype', label: 'Prototype', description: 'Validate the interaction model.' },
        { optionKey: 'none-of-the-above', label: 'None of the above', description: 'Add a note with a better answer.' },
      ],
    }],
    readiness: {
      objectiveClear: true,
      scopeBounded: false,
      hasAcceptanceCriteria: false,
      knownRequirements: ['Build a planning UI'],
      unresolvedUnknowns: [],
      blockingUnknowns: ['Success criteria'],
      confidence: 0.5,
      recommendedNextAction: 'ask_questions',
      reasonSummary: ['Acceptance criteria are missing.'],
    },
    clarificationTurnCount: 1,
    planArtifact: null,
    failureMessage: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:01:00.000Z',
    events: [],
    toolCalls: [],
    capabilities: ['view', 'submit_input', 'cancel'],
    ...overrides,
  };
}

describe('PlanningWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseSocket.mockReturnValue({ current: { on: vi.fn(), off: vi.fn() } });
    mockedFetchBoards.mockResolvedValue([board]);
    mockedFetchAgentRuns.mockResolvedValue([]);
    mockedFetchAgentRunDetail.mockResolvedValue(createRun());
  });

  it('creates a planning run for the selected board', async () => {
    const createdRun = createRun({ title: 'Created plan', state: 'queued', questions: [], capabilities: ['view', 'cancel'] });
    mockedCreatePlanningAgentRun.mockResolvedValue(createdRun);

    renderWithProviders(<PlanningWorkspace organizationId="12" />);

    fireEvent.change(await screen.findByLabelText('What should the agent plan?'), {
      target: { value: 'Create a clean planning UI' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create plan/i }));

    await waitFor(() => {
      expect(mockedCreatePlanningAgentRun).toHaveBeenCalledWith(
        '12',
        '5',
        'Create a clean planning UI'
      );
    });
    expect(await screen.findByText('Created plan')).toBeInTheDocument();
  });

  it('renders clarification cards and submits all answers', async () => {
    mockedFetchAgentRuns.mockResolvedValue([createRun()]);
    mockedSubmitAgentRunInput.mockResolvedValue(createRun({ state: 'queued', questions: [] }));

    renderWithProviders(<PlanningWorkspace organizationId="12" />);

    expect(await screen.findByText('What should count as success?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /End-to-end demo/i }));
    fireEvent.click(screen.getByRole('button', { name: /submit answers/i }));

    await waitFor(() => {
      expect(mockedSubmitAgentRunInput).toHaveBeenCalledWith('12', '5', 44, [{
        questionKey: 'success-bar',
        selectedOptionKey: 'demo',
        note: null,
      }]);
    });
  });
});

// Verifies durable agent worker handling for provider normalization, progress messages, and failures.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedPublishBoardUpdate } = vi.hoisted(() => ({
  mockedPublishBoardUpdate: vi.fn(),
}));

vi.mock('@/lib/wsServer', () => ({
  publishBoardUpdate: mockedPublishBoardUpdate,
}));

import { createAgentRun } from '@/lib/agents/application/runService';
import { AgentRepository } from '@/lib/agents/infrastructure/repository';
import { processNextAgentJob } from '@/lib/agents/worker/agentWorker';
import { addBoardMember, createBoardRecord, createOrganizationRecord, createUser } from '../factories';
import { db, resetDatabase } from '../db';

async function createWorkerFixture(prompt = 'Build a payment reconciliation ledger exception workflow for fintech operators') {
  const user = await createUser();
  const organization = await createOrganizationRecord({ createdBy: user.id });
  const board = await createBoardRecord({ createdBy: user.id, organizationId: organization.id });
  await addBoardMember(board.id, user.id);
  const run = await createAgentRun({
    organizationId: organization.id,
    boardId: board.id,
    userId: user.id,
    data: { prompt, runType: 'planning' },
  });

  return { board, organization, run, user };
}

// Builds an analysis payload that deterministically reaches final plan generation.
function createCompleteAnalysisPayload() {
  return {
    title: 'Payment reconciliation ledger exceptions',
    summary: 'Plan payment reconciliation ledger exception handling for fintech operators.',
    assistantMessage: null,
    contextPatch: {
      objective: 'Build a payment reconciliation ledger exception workflow for fintech operators.',
      inScope: ['Payment reconciliation ledger exception workflow'],
      outOfScope: ['Autonomous GitHub writes'],
      acceptanceCriteria: ['Fintech operators can review and resolve ledger exceptions.'],
      constraints: ['Keep planning work under org-scoped agent APIs.'],
      technicalDecisions: [{
        area: 'workflow boundary',
        choice: 'payment reconciliation ledger exception review',
        rationale: 'The first plan must stay anchored to operator exception handling.',
        source: 'explicit',
      }],
      planningConfidence: 0.9,
    },
    knownRequirements: [
      'Fintech operators need payment reconciliation ledger exception review.',
      'The workflow must expose traceable exception resolution.',
    ],
    unresolvedUnknowns: [],
    blockingUnknowns: [],
    resolvedQuestionKeys: [],
    candidateQuestions: [],
    confidence: 0.9,
    decision: { action: 'complete_planning', reason: 'requirements_satisfied' },
  };
}

// Builds a final artifact with recoverable object arrays that should still pass quality review.
function createRecoverablePlanArtifactPayload() {
  return {
    summary: 'Implement payment reconciliation ledger exception review for fintech operators.',
    objective: 'Build the payment reconciliation ledger exception workflow for fintech operators.',
    scope: {
      inScope: ['Payment reconciliation ledger exception workflow'],
      outOfScope: ['Autonomous GitHub writes'],
    },
    requirements: ['Fintech operators can review payment ledger mismatches and resolve exceptions.'],
    assumptions: [{ text: 'Existing payment ledger records are available for reconciliation.' }],
    constraints: ['Keep planning work under org-scoped agent APIs.'],
    affectedAreas: ['agent backend', 'planning workspace'],
    technicalDecisions: [{
      area: 'workflow boundary',
      choice: 'payment reconciliation ledger exception review',
      rationale: 'The first implementation plan must focus on operator exception handling.',
      source: 'explicit',
    }],
    implementationPhases: [{
      id: 'ledger-exception-review',
      title: 'Payment ledger exception review',
      summary: 'Model and expose payment reconciliation ledger exceptions for fintech operators.',
      tasks: [{
        id: 'ledger-exception-model',
        title: 'Payment ledger exception model',
        description: 'Persist payment reconciliation exception records with operator resolution status.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: [{ criterion: 'Fintech operators can filter unresolved payment ledger exceptions.' }],
      }],
    }],
    risks: ['Incorrect ledger matching can hide payment reconciliation exceptions.'],
    successCriteria: ['Fintech operators can resolve a payment ledger exception with traceable status.'],
    openQuestions: [],
    notes: [],
  };
}

describe('agent worker provider recovery', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockedPublishBoardUpdate.mockResolvedValue(undefined);
    await resetDatabase();
  });

  it('normalizes a recoverable final artifact and reaches quality evaluation', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { run } = await createWorkerFixture();
    const mockedFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ message: { content: JSON.stringify(createCompleteAnalysisPayload()) } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ message: { content: JSON.stringify(createRecoverablePlanArtifactPayload()) } }),
      });
    vi.stubGlobal('fetch', mockedFetch);

    const processed = await processNextAgentJob();
    const updatedRun = await AgentRepository.getRun(run.id);
    const messages = await AgentRepository.listMessages(run.id);

    expect(processed).toBe(true);
    expect(updatedRun?.state).toBe('awaiting_plan_review');
    expect(updatedRun?.planArtifact?.assumptions).toEqual([
      'Existing payment ledger records are available for reconciliation.',
    ]);
    expect(updatedRun?.planArtifact?.implementationPhases[0]?.tasks[0]?.acceptanceCriteria).toEqual([
      'Fintech operators can filter unresolved payment ledger exceptions.',
    ]);
    expect(updatedRun?.planArtifact?.quality?.passed).toBe(true);
    expect(messages.some((message) => message.content === 'I have enough context and am generating the implementation plan.')).toBe(true);
  });

  it('stores structured diagnostics for unrecoverable provider format failures', async () => {
    const { run } = await createWorkerFixture();
    const invalidArtifact = {
      ...createRecoverablePlanArtifactPayload(),
      assumptions: [{ nested: { text: 'Nested provider output should not be flattened.' } }],
    };
    const mockedFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ message: { content: JSON.stringify(createCompleteAnalysisPayload()) } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ message: { content: JSON.stringify(invalidArtifact) } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ message: { content: JSON.stringify(invalidArtifact) } }),
      });
    vi.stubGlobal('fetch', mockedFetch);

    await processNextAgentJob();
    const failedRun = await AgentRepository.getRun(run.id);
    const events = await AgentRepository.listEvents(run.id);
    const job = await db('agent_jobs').where({ run_id: run.id }).first();
    const jobError = JSON.parse(String(job?.error_message)) as {
      category: string;
      providerValidation: { phase: string; issuePaths: string[]; retryable: boolean };
    };

    expect(failedRun?.state).toBe('failed');
    expect(failedRun?.failureMessage).toBe('The planning provider returned an invalid response format. Retry this run to generate the plan again.');
    expect(events.at(-1)?.payload).toMatchObject({
      category: 'provider_validation',
      providerValidation: {
        phase: 'plan_artifact',
        retryCount: 1,
        retryable: true,
      },
    });
    expect(job?.state).toBe('failed');
    expect(jobError.category).toBe('provider_validation');
    expect(jobError.providerValidation.issuePaths).toContain('assumptions.0');
  });
});

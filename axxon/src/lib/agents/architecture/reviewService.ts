// Coordinates authorization, stale checks, validated operation application, and audit events for architecture proposal review.
import db from '@/lib/db/db';
import { AgentRepository } from '@/lib/agents/infrastructure/repository';
import { assertAgentTransition, type AgentRun } from '@/lib/agents/domain';
import { Architecture } from '@/lib/models/architecture';
import { publishProjectUpdate } from '@/lib/wsServer';
import { requireProjectMember } from '@/lib/utils/authorization';
import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';
import type { ArchitectureChangeProposal } from './contracts';
import { ArchitectureChangeSets } from './changeSets';

async function getProjectRun(organizationId: number, projectId: number, runId: number, userId: number) {
  await requireProjectMember(organizationId, projectId, userId);
  const run = await AgentRepository.getRun(runId);
  if (!run || run.organizationId !== organizationId || run.projectId !== projectId) throw new NotFoundError('Architecture agent run not found');
  return run;
}

async function canReview(run: AgentRun, organizationId: number, userId: number) {
  // Architecture review is intentionally a project-member action; the project boundary is already enforced by getProjectRun.
  await requireProjectMember(organizationId, run.projectId!, userId);
}

function proposalForRun(run: AgentRun) {
  const proposal = run.planArtifact?.architectureProposal as ArchitectureChangeProposal | undefined;
  if (!proposal) throw new BadRequestError('This run does not contain an architecture proposal');
  return proposal;
}

// Keeps a committed review from surfacing as an API failure when Redis is temporarily unavailable.
async function publishArchitectureUpdate(projectId: number, payload: unknown) {
  try {
    await publishProjectUpdate(projectId, payload);
  } catch (error) {
    console.error('[ARCHITECTURE_REALTIME_ERROR]', error);
  }
}

// Applies a proposal exactly once, creating a revision and marking the run completed in one database transaction.
export async function approveArchitectureProposal(input: { organizationId: number; projectId: number; runId: number; userId: number }) {
  const run = await getProjectRun(input.organizationId, input.projectId, input.runId, input.userId);
  await canReview(run, input.organizationId, input.userId);
  if (run.state !== 'awaiting_plan_review') throw new BadRequestError('This proposal is no longer awaiting review');
  const proposal = proposalForRun(run);
  if (proposal.baseRevisionId <= 0) throw new BadRequestError('Architecture proposal has no valid base revision');

  let result: { updatedRun: AgentRun; revision: Awaited<ReturnType<typeof Architecture.applyApprovedProposal>> };
  try {
    result = await db.transaction(async (trx) => {
      const lockedRun = await AgentRepository.lockRun(run.id, trx);
      if (!lockedRun || lockedRun.version !== run.version) throw new BadRequestError('Architecture proposal changed; refresh before approving');
      const nextState = assertAgentTransition(lockedRun.state, 'architecture.applied');
      const changeSet = await ArchitectureChangeSets.getByRun(run.id, trx);
      if (!changeSet) throw new BadRequestError('Architecture change set is missing for this proposal');
      const currentGraph = await ArchitectureChangeSets.assertCurrent(changeSet, input.projectId);
      const changeSetProposal = { ...proposal, baseRevisionId: Number(changeSet.base_revision_id), operations: changeSet.operations_json } as ArchitectureChangeProposal;
      if (JSON.stringify(changeSet.operations_json) !== JSON.stringify(proposal.operations)) throw new BadRequestError('Architecture proposal content no longer matches its immutable change set');
      if (!currentGraph) throw new BadRequestError('Architecture proposal is stale');
      const revision = await Architecture.applyApprovedProposal(input.projectId, input.userId, changeSetProposal, trx);
      await ArchitectureChangeSets.markReviewed(changeSet.id, input.userId, 'approved', null, trx);
      const updatedRun = await AgentRepository.updateRun(lockedRun.id, lockedRun.version, { state: nextState }, trx);
      await AgentRepository.appendEvent({ runId: lockedRun.id, type: 'architecture.applied', fromState: lockedRun.state, toState: nextState, actorType: 'user', actorId: input.userId, payload: { revisionId: revision.id, revisionVersion: revision.version } }, trx);
      return { updatedRun, revision };
    });
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }
  await publishArchitectureUpdate(input.projectId, { type: 'architecture:updated', payload: result });
  return result;
}

// Records reviewer feedback and queues a fresh planning turn without mutating canonical architecture state.
export async function requestArchitectureChanges(input: { organizationId: number; projectId: number; runId: number; userId: number; feedback: string }) {
  const run = await getProjectRun(input.organizationId, input.projectId, input.runId, input.userId);
  await canReview(run, input.organizationId, input.userId);
  const feedback = input.feedback.trim();
  if (!feedback || feedback.length > 4000) throw new BadRequestError('Change request feedback must be between 1 and 4000 characters');
  let result: AgentRun;
  try {
    result = await db.transaction(async (trx) => {
      const lockedRun = await AgentRepository.lockRun(run.id, trx);
      if (!lockedRun || lockedRun.version !== run.version) throw new BadRequestError('Architecture proposal changed; refresh before requesting changes');
      const nextState = assertAgentTransition(lockedRun.state, 'changes.requested');
      await AgentRepository.addMessage(lockedRun.id, 'user', feedback, { kind: 'architecture_change_request' }, trx);
      const updatedRun = await AgentRepository.updateRun(lockedRun.id, lockedRun.version, { state: nextState }, trx);
      await AgentRepository.appendEvent({ runId: lockedRun.id, type: 'changes.requested', fromState: lockedRun.state, toState: nextState, actorType: 'user', actorId: input.userId, payload: { feedback } }, trx);
      const changeSet = await ArchitectureChangeSets.getByRun(lockedRun.id, trx);
      if (changeSet) await ArchitectureChangeSets.markReviewed(changeSet.id, input.userId, 'changes_requested', feedback, trx);
      await AgentRepository.enqueueJob(lockedRun.id, 'prepare', trx);
      return updatedRun;
    });
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }
  await publishArchitectureUpdate(input.projectId, { type: 'architecture:updated', payload: { updatedRun: result } });
  return result;
}

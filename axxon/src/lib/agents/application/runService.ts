// Coordinates authorized agent commands through transactions, state transitions, jobs, and outbox records.
import db from '@/lib/db/db';
import { requireBoardInOrganization, requireOrganizationOwner } from '@/lib/utils/authorization';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/utils/apiErrors';
import {
  assertAgentTransition,
  getAgentCapabilities,
  type AgentActorType,
  type AgentPlanArtifact,
  type AgentQuestion,
  type AgentRunDetail,
  type AgentRunEventType,
  type CreateAgentRunCommand,
  type RequestAgentChangesCommand,
  type SubmitAgentInputCommand,
} from '../domain';
import { AgentRepository } from '../infrastructure/repository';

function normalizePrompt(prompt: unknown) {
  if (typeof prompt !== 'string') throw new BadRequestError('Agent prompt must be a string');
  const value = prompt.trim();
  if (!value || value.length > 12_000) throw new BadRequestError('Agent prompt must be between 1 and 12000 characters');
  return value;
}

function validateInputAnswers(questions: AgentQuestion[], answers: Record<string, string>) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new BadRequestError('Agent answers must be a JSON object');
  }

  for (const question of questions) {
    const rawAnswer = answers[question.key];
    if (rawAnswer !== undefined && typeof rawAnswer !== 'string') {
      throw new BadRequestError(`Answer must be a string for ${question.key}`);
    }
    const answer = rawAnswer?.trim();
    if (question.required && !answer) throw new BadRequestError(`Answer is required for ${question.key}`);
    if (answer && question.options.length > 0 && !question.options.some((option) => option.key === answer)) {
      throw new BadRequestError(`Answer is not valid for ${question.key}`);
    }
  }
}

function titleFromPrompt(prompt: string) {
  return prompt.replace(/\s+/g, ' ').trim().slice(0, 120);
}

async function getAccess(run: { organizationId: number; boardId: number; createdBy: number }, userId: number) {
  await requireBoardInOrganization(run.organizationId, run.boardId, userId);
  let isOrganizationOwner = false;
  try {
    await requireOrganizationOwner(run.organizationId, userId);
    isOrganizationOwner = true;
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
  }
  return { isInitiator: run.createdBy === userId, isOrganizationOwner };
}

async function getRunForBoard(organizationId: number, boardId: number, runId: number, userId: number) {
  await requireBoardInOrganization(organizationId, boardId, userId);
  const run = await AgentRepository.getRun(runId);
  if (!run || run.organizationId !== organizationId || run.boardId !== boardId) throw new NotFoundError('Agent run not found');
  return run;
}

async function transitionRun({
  runId,
  event,
  actorType,
  actorId = null,
  payload = null,
  update = {},
}: {
  runId: number;
  event: AgentRunEventType;
  actorType: AgentActorType;
  actorId?: number | null;
  payload?: Record<string, unknown> | null;
  update?: { questions?: AgentQuestion[]; planArtifact?: AgentPlanArtifact | null; failureMessage?: string | null };
}) {
  return db.transaction(async (trx) => {
    const run = await AgentRepository.lockRun(runId, trx);
    if (!run) throw new NotFoundError('Agent run not found');
    const nextState = assertAgentTransition(run.state, event);
    const updatedRun = await AgentRepository.updateRun(run.id, run.version, { state: nextState, ...update }, trx);
    await AgentRepository.appendEvent({ runId, type: event, fromState: run.state, toState: nextState, actorType, actorId, payload }, trx);
    return updatedRun;
  });
}

function assertCapability(capabilities: string[], capability: string) {
  if (!capabilities.includes(capability)) throw new ForbiddenError('You cannot perform this action for the current agent run state');
}

export async function getAgentRunDetail(input: { organizationId: number; boardId: number; runId: number; userId: number }): Promise<AgentRunDetail> {
  const run = await getRunForBoard(input.organizationId, input.boardId, input.runId, input.userId);
  const access = await getAccess(run, input.userId);
  return { ...run, events: await AgentRepository.listEvents(run.id), capabilities: getAgentCapabilities(run.state, access) };
}

export async function listAgentRuns(input: { organizationId: number; boardId: number; userId: number }) {
  await requireBoardInOrganization(input.organizationId, input.boardId, input.userId);
  return AgentRepository.listBoardRuns(input.organizationId, input.boardId);
}

export async function createAgentRun(input: { organizationId: number; boardId: number; userId: number; data: CreateAgentRunCommand }) {
  await requireBoardInOrganization(input.organizationId, input.boardId, input.userId);
  const prompt = normalizePrompt(input.data.prompt);
  const run = await db.transaction(async (trx) => {
    const created = await AgentRepository.createRun({ organizationId: input.organizationId, boardId: input.boardId, createdBy: input.userId, title: titleFromPrompt(prompt), prompt }, trx);
    await AgentRepository.appendEvent({ runId: created.id, type: 'run.created', fromState: null, toState: 'queued', actorType: 'user', actorId: input.userId }, trx);
    await AgentRepository.addMessage(created.id, 'user', prompt, null, trx);
    await AgentRepository.enqueueJob(created.id, 'prepare', trx);
    return created;
  });
  return getAgentRunDetail({ organizationId: input.organizationId, boardId: input.boardId, runId: run.id, userId: input.userId });
}

export async function submitAgentInput(input: { organizationId: number; boardId: number; runId: number; userId: number; data: SubmitAgentInputCommand }) {
  const run = await getRunForBoard(input.organizationId, input.boardId, input.runId, input.userId);
  assertCapability(getAgentCapabilities(run.state, await getAccess(run, input.userId)), 'submit_input');
  await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(run.id, trx);
    if (!locked) throw new NotFoundError('Agent run not found');
    const nextState = assertAgentTransition(locked.state, 'input.submitted');
    validateInputAnswers(locked.questions, input.data.answers);
    await AgentRepository.addMessage(locked.id, 'user', JSON.stringify(input.data.answers), { answers: input.data.answers }, trx);
    const updated = await AgentRepository.updateRun(locked.id, locked.version, { state: nextState, questions: [] }, trx);
    await AgentRepository.appendEvent({ runId: locked.id, type: 'input.submitted', fromState: locked.state, toState: updated.state, actorType: 'user', actorId: input.userId, payload: { answers: input.data.answers } }, trx);
    await AgentRepository.enqueueJob(locked.id, 'prepare', trx);
  });
  return getAgentRunDetail({ organizationId: input.organizationId, boardId: input.boardId, runId: input.runId, userId: input.userId });
}

export async function requestAgentChanges(input: { organizationId: number; boardId: number; runId: number; userId: number; data: RequestAgentChangesCommand }) {
  const run = await getRunForBoard(input.organizationId, input.boardId, input.runId, input.userId);
  assertCapability(getAgentCapabilities(run.state, await getAccess(run, input.userId)), 'request_changes');
  const feedback = normalizePrompt(input.data.feedback);
  await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(run.id, trx);
    if (!locked) throw new NotFoundError('Agent run not found');
    const nextState = assertAgentTransition(locked.state, 'changes.requested');
    await AgentRepository.addMessage(locked.id, 'user', feedback, { kind: 'change_request' }, trx);
    const updated = await AgentRepository.updateRun(locked.id, locked.version, { state: nextState, planArtifact: null }, trx);
    await AgentRepository.appendEvent({ runId: locked.id, type: 'changes.requested', fromState: locked.state, toState: updated.state, actorType: 'user', actorId: input.userId, payload: { feedback } }, trx);
    await AgentRepository.enqueueJob(locked.id, 'prepare', trx);
  });
  return getAgentRunDetail({ organizationId: input.organizationId, boardId: input.boardId, runId: input.runId, userId: input.userId });
}

export async function approveAgentPlan(input: { organizationId: number; boardId: number; runId: number; userId: number }) {
  const run = await getRunForBoard(input.organizationId, input.boardId, input.runId, input.userId);
  assertCapability(getAgentCapabilities(run.state, await getAccess(run, input.userId)), 'approve_plan');
  await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(run.id, trx);
    if (!locked) throw new NotFoundError('Agent run not found');
    const nextState = assertAgentTransition(locked.state, 'plan.approved');
    const updated = await AgentRepository.updateRun(locked.id, locked.version, { state: nextState }, trx);
    await AgentRepository.appendEvent({ runId: locked.id, type: 'plan.approved', fromState: locked.state, toState: updated.state, actorType: 'user', actorId: input.userId }, trx);
    await AgentRepository.createOutboxEvent(locked.id, { runId: locked.id, boardId: locked.boardId, organizationId: locked.organizationId, artifact: locked.planArtifact }, trx);
    await AgentRepository.enqueueJob(locked.id, 'dispatch', trx);
  });
  return getAgentRunDetail({ organizationId: input.organizationId, boardId: input.boardId, runId: input.runId, userId: input.userId });
}

export async function retryAgentRun(input: { organizationId: number; boardId: number; runId: number; userId: number }) {
  const run = await getRunForBoard(input.organizationId, input.boardId, input.runId, input.userId);
  assertCapability(getAgentCapabilities(run.state, await getAccess(run, input.userId)), 'retry');
  await transitionRun({ runId: run.id, event: 'run.retried', actorType: 'user', actorId: input.userId, update: { failureMessage: null } });
  await AgentRepository.enqueueJob(run.id, 'prepare');
  return getAgentRunDetail({ organizationId: input.organizationId, boardId: input.boardId, runId: input.runId, userId: input.userId });
}

export async function cancelAgentRun(input: { organizationId: number; boardId: number; runId: number; userId: number }) {
  const run = await getRunForBoard(input.organizationId, input.boardId, input.runId, input.userId);
  assertCapability(getAgentCapabilities(run.state, await getAccess(run, input.userId)), 'cancel');
  await transitionRun({ runId: run.id, event: 'run.cancelled', actorType: 'user', actorId: input.userId });
  return getAgentRunDetail({ organizationId: input.organizationId, boardId: input.boardId, runId: input.runId, userId: input.userId });
}

export async function applyWorkerPreparation(runId: number, result: { questions?: AgentQuestion[]; artifact?: AgentPlanArtifact }) {
  const run = await AgentRepository.getRun(runId);
  if (!run || run.state !== 'preparing') return null;
  if (result.questions?.length) return transitionRun({ runId, event: 'input.required', actorType: 'worker', update: { questions: result.questions } });
  if (!result.artifact) throw new Error('Agent provider returned neither questions nor a plan artifact');
  await transitionRun({ runId, event: 'planning.started', actorType: 'worker' });
  return transitionRun({ runId, event: 'plan.generated', actorType: 'worker', update: { planArtifact: result.artifact } });
}

export async function claimAgentRunForWork(runId: number) {
  const run = await AgentRepository.getRun(runId);
  if (!run || run.state !== 'queued') return null;
  return transitionRun({ runId, event: 'worker.claimed', actorType: 'worker' });
}

export async function deliverAgentDispatch(runId: number) {
  const run = await AgentRepository.getRun(runId);
  if (!run || run.state !== 'dispatching') return null;
  await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(runId, trx);
    if (!locked || locked.state !== 'dispatching') return;
    const nextState = assertAgentTransition(locked.state, 'dispatch.delivered');
    const updated = await AgentRepository.updateRun(locked.id, locked.version, { state: nextState }, trx);
    await AgentRepository.markOutboxPublished(locked.id, trx);
    await AgentRepository.appendEvent({ runId: locked.id, type: 'dispatch.delivered', fromState: locked.state, toState: updated.state, actorType: 'worker' }, trx);
  });
  return AgentRepository.getRun(runId);
}

export async function failAgentRun(runId: number, message: string) {
  const run = await AgentRepository.getRun(runId);
  if (!run || ['completed', 'cancelled'].includes(run.state)) return null;
  return transitionRun({ runId, event: 'run.failed', actorType: 'worker', update: { failureMessage: message } });
}

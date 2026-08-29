// Coordinates authorized agent commands through transactions, state transitions, jobs, tool calls, and outbox records.
import db from '@/lib/db/db';
import { requireBoardInOrganization, requireOrganizationOwner } from '@/lib/utils/authorization';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/utils/apiErrors';
import { publishBoardUpdate } from '@/lib/wsServer';
import {
  applyClarificationAnswersToContext,
  applyPromptPlanningDefaults,
  assertAgentTransition,
  attachPlanArtifactQuality,
  buildClarificationAnswerSummary,
  buildPlanningRunTitle,
  createEmptyPlanningContext,
  createInitialPlanningReadiness,
  createAgentRunCommandSchema,
  evaluatePlanningReadiness,
  getAgentCapabilities,
  mergePlanningContext,
  normalizeAgentQuestionKey,
  requestAgentChangesCommandSchema,
  submitAgentInputCommandSchema,
  submitAgentMessageCommandSchema,
  type AgentActorType,
  type AgentClarificationAnswer,
  type AgentPlanArtifact,
  type AgentPlanningDecision,
  type AgentPlanningQuality,
  type AgentPlanningTurnAnalysis,
  type AgentQuestion,
  type AgentRun,
  type AgentRunDetail,
  type AgentRunEventType,
  type CreateAgentRunCommand,
  type RequestAgentChangesCommand,
  type SubmitAgentInputCommand,
  type SubmitAgentMessageCommand,
} from '../domain';
import { AgentRepository } from '../infrastructure/repository';
import { executeAgentTool } from '../toolCalls/registry';

type RunUpdate = Partial<Pick<AgentRun, 'questions' | 'planningContext' | 'readiness' | 'clarificationTurnCount' | 'planArtifact' | 'failureMessage'>>;

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
  update?: RunUpdate;
}) {
  const updatedRun = await db.transaction(async (trx) => {
    const run = await AgentRepository.lockRun(runId, trx);
    if (!run) throw new NotFoundError('Agent run not found');
    const nextState = assertAgentTransition(run.state, event);
    const updatedRun = await AgentRepository.updateRun(run.id, run.version, { state: nextState, ...update }, trx);
    await AgentRepository.appendEvent({ runId, type: event, fromState: run.state, toState: nextState, actorType, actorId, payload }, trx);
    return updatedRun;
  });

  await publishAgentRunUpdate(updatedRun);
  return updatedRun;
}

function assertCapability(capabilities: string[], capability: string) {
  if (!capabilities.includes(capability)) throw new ForbiddenError('You cannot perform this action for the current agent run state');
}

async function publishAgentRunUpdate(run: AgentRun | null) {
  if (!run) return;

  try {
    await publishBoardUpdate(String(run.boardId), {
      type: 'agent:run:updated',
      payload: { run },
    });
  } catch (error) {
    console.error('[AGENT_RUN_REALTIME_ERROR]', error);
  }
}

function requirePlanningRun(run: AgentRun) {
  if (run.runType !== 'planning') {
    throw new BadRequestError(`Agent run type "${run.runType}" is not implemented yet`);
  }
}

function countAnsweredQuestions(messages: Array<{ metadata?: unknown }>) {
  return messages.reduce((count, message) => {
    const metadata = message.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return count;
    const answers = (metadata as Record<string, unknown>).answers;
    return Array.isArray(answers) ? count + answers.length : count;
  }, 0);
}

function extractHistoricalQuestions(toolCalls: Awaited<ReturnType<typeof AgentRepository.listToolCalls>>) {
  return toolCalls.flatMap((toolCall) => {
    const questions = toolCall.result?.questions;
    return Array.isArray(questions) ? questions as AgentQuestion[] : [];
  });
}

function validateClarificationAnswers(questions: AgentQuestion[], answers: AgentClarificationAnswer[]) {
  if (questions.length === 0) throw new BadRequestError('There are no open clarification questions to answer');
  if (answers.length !== questions.length) throw new BadRequestError('Answer every clarification question before submitting');

  const questionsByKey = new Map(questions.map((question) => [normalizeAgentQuestionKey(question.questionKey), question]));
  const seenQuestionKeys = new Set<string>();

  return answers.map((answer) => {
    const questionKey = normalizeAgentQuestionKey(answer.questionKey);
    const selectedOptionKey = normalizeAgentQuestionKey(answer.selectedOptionKey);

    if (seenQuestionKeys.has(questionKey)) throw new BadRequestError('Each clarification question can only be answered once');
    seenQuestionKeys.add(questionKey);

    const question = questionsByKey.get(questionKey);
    if (!question) throw new BadRequestError('Clarification answers do not match the current question set');
    if (!question.options.some((option) => option.optionKey === selectedOptionKey)) {
      throw new BadRequestError('Selected clarification option is invalid');
    }

    return { ...answer, questionKey, selectedOptionKey, note: answer.note?.trim() || null };
  });
}

export async function getAgentRunDetail(input: { organizationId: number; boardId: number; runId: number; userId: number }): Promise<AgentRunDetail> {
  const run = await getRunForBoard(input.organizationId, input.boardId, input.runId, input.userId);
  const access = await getAccess(run, input.userId);
  return {
    ...run,
    events: await AgentRepository.listEvents(run.id),
    messages: await AgentRepository.listMessages(run.id),
    toolCalls: await AgentRepository.listToolCalls(run.id),
    capabilities: getAgentCapabilities(run.state, access),
  };
}

export async function submitAgentRunMessage(input: { organizationId: number; boardId: number; runId: number; userId: number; data: SubmitAgentMessageCommand }) {
  const run = await getRunForBoard(input.organizationId, input.boardId, input.runId, input.userId);
  requirePlanningRun(run);
  assertCapability(getAgentCapabilities(run.state, await getAccess(run, input.userId)), 'submit_message');
  const parsed = submitAgentMessageCommandSchema.safeParse(input.data);
  if (!parsed.success) throw new BadRequestError('Invalid agent message payload');

  const outcome = await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(run.id, trx);
    if (!locked) throw new NotFoundError('Agent run not found');
    const nextState = assertAgentTransition(locked.state, 'message.submitted');
    await AgentRepository.addMessage(locked.id, 'user', parsed.data.message, { kind: 'user_context' }, trx);
    const shouldResetPlanning = locked.state === 'awaiting_input' || locked.state === 'awaiting_message';
    const updated = await AgentRepository.updateRun(locked.id, locked.version, {
      state: nextState,
      ...(shouldResetPlanning ? {
        questions: [],
        readiness: createInitialPlanningReadiness(),
        planArtifact: null,
      } : {}),
    }, trx);
    await AgentRepository.appendEvent({
      runId: locked.id,
      type: 'message.submitted',
      fromState: locked.state,
      toState: updated.state,
      actorType: 'user',
      actorId: input.userId,
      payload: { messageLength: parsed.data.message.length },
    }, trx);
    if (shouldResetPlanning) {
      await AgentRepository.enqueueJob(locked.id, 'prepare', trx);
    }
    return updated;
  });

  await publishAgentRunUpdate(outcome);
  return getAgentRunDetail({ organizationId: input.organizationId, boardId: input.boardId, runId: input.runId, userId: input.userId });
}

export async function listAgentRuns(input: { organizationId: number; boardId: number; userId: number }) {
  await requireBoardInOrganization(input.organizationId, input.boardId, input.userId);
  return AgentRepository.listBoardRuns(input.organizationId, input.boardId);
}

export async function createAgentRun(input: { organizationId: number; boardId: number; userId: number; data: CreateAgentRunCommand }) {
  await requireBoardInOrganization(input.organizationId, input.boardId, input.userId);
  const parsed = createAgentRunCommandSchema.safeParse(input.data);
  if (!parsed.success) throw new BadRequestError('Invalid agent run payload');
  if (parsed.data.runType !== 'planning') throw new BadRequestError(`Agent run type "${parsed.data.runType}" is not implemented yet`);

  const prompt = parsed.data.prompt;
  const run = await db.transaction(async (trx) => {
    const created = await AgentRepository.createRun({
      organizationId: input.organizationId,
      boardId: input.boardId,
      createdBy: input.userId,
      runType: parsed.data.runType,
      title: buildPlanningRunTitle(prompt),
      prompt,
    }, trx);
    await AgentRepository.appendEvent({ runId: created.id, type: 'run.created', fromState: null, toState: 'queued', actorType: 'user', actorId: input.userId }, trx);
    await AgentRepository.addMessage(created.id, 'user', prompt, null, trx);
    await AgentRepository.enqueueJob(created.id, 'prepare', trx);
    return created;
  });
  await publishAgentRunUpdate(run);
  return getAgentRunDetail({ organizationId: input.organizationId, boardId: input.boardId, runId: run.id, userId: input.userId });
}

export async function submitAgentInput(input: { organizationId: number; boardId: number; runId: number; userId: number; data: SubmitAgentInputCommand }) {
  const run = await getRunForBoard(input.organizationId, input.boardId, input.runId, input.userId);
  requirePlanningRun(run);
  assertCapability(getAgentCapabilities(run.state, await getAccess(run, input.userId)), 'submit_input');
  const parsed = submitAgentInputCommandSchema.safeParse(input.data);
  if (!parsed.success) throw new BadRequestError('Invalid agent input payload');

  const updatedRun = await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(run.id, trx);
    if (!locked) throw new NotFoundError('Agent run not found');
    const nextState = assertAgentTransition(locked.state, 'input.submitted');
    const answers = validateClarificationAnswers(locked.questions, parsed.data.answers);
    const planningContext = applyClarificationAnswersToContext({
      context: locked.planningContext || createEmptyPlanningContext(),
      questions: locked.questions,
      answers,
    });
    await AgentRepository.addMessage(locked.id, 'user', buildClarificationAnswerSummary(locked.questions, answers), { answers }, trx);
    const updated = await AgentRepository.updateRun(locked.id, locked.version, { state: nextState, questions: [], planningContext }, trx);
    await AgentRepository.appendEvent({ runId: locked.id, type: 'input.submitted', fromState: locked.state, toState: updated.state, actorType: 'user', actorId: input.userId, payload: { answers } }, trx);
    await AgentRepository.enqueueJob(locked.id, 'prepare', trx);
    return updated;
  });
  await publishAgentRunUpdate(updatedRun);
  return getAgentRunDetail({ organizationId: input.organizationId, boardId: input.boardId, runId: input.runId, userId: input.userId });
}

export async function requestAgentChanges(input: { organizationId: number; boardId: number; runId: number; userId: number; data: RequestAgentChangesCommand }) {
  const run = await getRunForBoard(input.organizationId, input.boardId, input.runId, input.userId);
  requirePlanningRun(run);
  assertCapability(getAgentCapabilities(run.state, await getAccess(run, input.userId)), 'request_changes');
  const parsed = requestAgentChangesCommandSchema.safeParse(input.data);
  if (!parsed.success) throw new BadRequestError('Invalid agent change request payload');
  const feedback = parsed.data.feedback;

  const updatedRun = await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(run.id, trx);
    if (!locked) throw new NotFoundError('Agent run not found');
    const nextState = assertAgentTransition(locked.state, 'changes.requested');
    await AgentRepository.addMessage(locked.id, 'user', feedback, { kind: 'change_request' }, trx);
    const updated = await AgentRepository.updateRun(locked.id, locked.version, {
      state: nextState,
      planArtifact: null,
      readiness: createInitialPlanningReadiness(),
    }, trx);
    await AgentRepository.appendEvent({ runId: locked.id, type: 'changes.requested', fromState: locked.state, toState: updated.state, actorType: 'user', actorId: input.userId, payload: { feedback } }, trx);
    await AgentRepository.enqueueJob(locked.id, 'prepare', trx);
    return updated;
  });
  await publishAgentRunUpdate(updatedRun);
  return getAgentRunDetail({ organizationId: input.organizationId, boardId: input.boardId, runId: input.runId, userId: input.userId });
}

export async function approveAgentPlan(input: { organizationId: number; boardId: number; runId: number; userId: number }) {
  const run = await getRunForBoard(input.organizationId, input.boardId, input.runId, input.userId);
  assertCapability(getAgentCapabilities(run.state, await getAccess(run, input.userId)), 'approve_plan');
  const updatedRun = await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(run.id, trx);
    if (!locked) throw new NotFoundError('Agent run not found');
    const nextState = assertAgentTransition(locked.state, 'plan.approved');
    const updated = await AgentRepository.updateRun(locked.id, locked.version, { state: nextState }, trx);
    await AgentRepository.appendEvent({ runId: locked.id, type: 'plan.approved', fromState: locked.state, toState: updated.state, actorType: 'user', actorId: input.userId }, trx);
    await AgentRepository.createOutboxEvent(locked.id, { runId: locked.id, boardId: locked.boardId, organizationId: locked.organizationId, artifact: locked.planArtifact }, trx);
    await AgentRepository.enqueueJob(locked.id, 'dispatch', trx);
    return updated;
  });
  await publishAgentRunUpdate(updatedRun);
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

export async function startAgentPlanningTurn(runId: number) {
  return transitionRun({ runId, event: 'planning.started', actorType: 'worker' });
}

export async function applyWorkerPlanningAnalysis(runId: number, analysis: AgentPlanningTurnAnalysis) {
  const messages = await AgentRepository.listMessages(runId);
  const toolCalls = await AgentRepository.listToolCalls(runId);
  const outcome = await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(runId, trx);
    if (!locked || locked.state !== 'planning') return null;
    requirePlanningRun(locked);

    const planningContext = applyPromptPlanningDefaults({
      context: mergePlanningContext(locked.planningContext || createEmptyPlanningContext(), analysis),
      prompt: locked.prompt,
    });
    const readiness = evaluatePlanningReadiness({
      analysis,
      context: planningContext,
      answeredQuestionCount: countAnsweredQuestions(messages),
      prompt: locked.prompt,
    });

    if (analysis.decision.action === 'respond') {
      const nextState = assertAgentTransition(locked.state, 'message.required');
      await AgentRepository.addMessage(locked.id, 'assistant', analysis.assistantMessage || 'What would you like me to plan?', { kind: 'planning_prompt' }, trx);
      const updatedRun = await AgentRepository.updateRun(locked.id, locked.version, {
        state: nextState,
        questions: [],
        planningContext,
        readiness,
      }, trx);
      await AgentRepository.appendEvent({
        runId: locked.id,
        type: 'message.required',
        fromState: locked.state,
        toState: updatedRun.state,
        actorType: 'worker',
        payload: { decision: analysis.decision },
      }, trx);
      return { action: 'await_message' as const, run: updatedRun, decision: analysis.decision };
    }

    if (readiness.recommendedNextAction === 'complete_planning') {
      await AgentRepository.addMessage(locked.id, 'assistant', 'I have enough context and am generating the implementation plan.', {
        kind: 'planning_progress',
        stage: 'generating_plan',
      }, trx);
      return {
        action: 'generate_plan' as const,
        run: await AgentRepository.updateRun(locked.id, locked.version, { planningContext, readiness }, trx),
        decision: analysis.decision,
      };
    }

    const historicalQuestions = extractHistoricalQuestions(toolCalls);
    const toolInput = {
      candidateQuestions: analysis.candidateQuestions,
      existingQuestions: [...historicalQuestions, ...locked.questions],
      planningContext,
      prompt: locked.prompt,
      readiness,
    };
    const toolResult = executeAgentTool({
      toolName: 'ask_clarification_questions',
      state: locked.state,
      input: toolInput,
    });

    if (toolResult.questions.length === 0) {
      const nextState = assertAgentTransition(locked.state, 'message.required');
      const updatedRun = await AgentRepository.updateRun(locked.id, locked.version, {
        state: nextState,
        questions: [],
        planningContext,
        readiness,
      }, trx);
      await AgentRepository.createToolCall({
        runId: locked.id,
        toolName: 'ask_clarification_questions',
        status: 'completed',
        reasonCode: analysis.decision.reason === 'requirements_satisfied' ? 'low_confidence' : analysis.decision.reason,
        toolInput: toolInput as unknown as Record<string, unknown>,
        result: toolResult as unknown as Record<string, unknown>,
      }, trx);
      await AgentRepository.addMessage(locked.id, 'assistant', buildNoUniqueQuestionMessage(), {
        kind: 'planning_prompt',
        toolName: 'ask_clarification_questions',
      }, trx);
      await AgentRepository.appendEvent({
        runId: locked.id,
        type: 'message.required',
        fromState: locked.state,
        toState: updatedRun.state,
        actorType: 'worker',
        payload: { decision: analysis.decision, readiness, reason: 'no_unique_clarification_questions' },
      }, trx);
      return { action: 'await_message' as const, run: updatedRun, decision: analysis.decision };
    }

    const nextState = assertAgentTransition(locked.state, 'input.required');
    const updatedRun = await AgentRepository.updateRun(locked.id, locked.version, {
      state: nextState,
      questions: toolResult.questions,
      planningContext,
      readiness,
      clarificationTurnCount: locked.clarificationTurnCount + 1,
    }, trx);
    await AgentRepository.createToolCall({
      runId: locked.id,
      toolName: 'ask_clarification_questions',
      status: 'completed',
      reasonCode: analysis.decision.reason === 'requirements_satisfied' ? 'low_confidence' : analysis.decision.reason,
      toolInput: toolInput as unknown as Record<string, unknown>,
      result: toolResult as unknown as Record<string, unknown>,
    }, trx);
    await AgentRepository.addMessage(locked.id, 'assistant', buildQuestionIntro(toolResult.questions), { toolName: 'ask_clarification_questions', questionKeys: toolResult.questions.map((question) => question.questionKey) }, trx);
    await AgentRepository.appendEvent({
      runId: locked.id,
      type: 'input.required',
      fromState: locked.state,
      toState: updatedRun.state,
      actorType: 'worker',
      payload: { decision: analysis.decision, readiness, questionKeys: toolResult.questions.map((question) => question.questionKey) },
    }, trx);
    return { action: 'await_input' as const, run: updatedRun, decision: analysis.decision };
  });
  if (outcome?.run) await publishAgentRunUpdate(outcome.run);
  return outcome;
}

export async function supersedeWorkerPlanning(runId: number) {
  const updatedRun = await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(runId, trx);
    if (!locked || locked.state !== 'planning') return null;
    const nextState = assertAgentTransition(locked.state, 'planning.superseded');
    const updated = await AgentRepository.updateRun(locked.id, locked.version, {
      state: nextState,
      questions: [],
      readiness: createInitialPlanningReadiness(),
    }, trx);
    await AgentRepository.appendEvent({
      runId: locked.id,
      type: 'planning.superseded',
      fromState: locked.state,
      toState: updated.state,
      actorType: 'worker',
      payload: { reason: 'new_user_message' },
    }, trx);
    await AgentRepository.enqueueJob(locked.id, 'prepare', trx);
    return updated;
  });
  await publishAgentRunUpdate(updatedRun);
  return updatedRun;
}

function buildQuestionIntro(questions: AgentQuestion[]) {
  return questions.length === 1
    ? 'I need one quick decision before I can generate the implementation plan.'
    : `I need ${questions.length} quick decisions before I can generate the implementation plan.`;
}

// Builds the assistant prompt used when all generated clarification cards would be duplicates.
function buildNoUniqueQuestionMessage() {
  return 'I have your previous answers. Add any remaining constraints, edge cases, or delivery expectations in a message so I can finish the implementation plan.';
}

// Builds the assistant prompt used when generated plans fail deterministic quality review.
function buildPlanQualityFailureMessage(quality: AgentPlanningQuality) {
  const issueSummary = quality.issues
    .slice(0, 3)
    .map((issue) => issue.message)
    .join(' ');

  return [
    'The generated plan was too generic to send for review.',
    issueSummary || 'Add the most important workflow details, constraints, or success criteria so I can generate a focused plan.',
  ].join(' ');
}

// Moves a planning run back to user-message input when generated plans remain too generic.
export async function requestWorkerPlanQualityInput(runId: number, quality: AgentPlanningQuality) {
  const updatedRun = await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(runId, trx);
    if (!locked || locked.state !== 'planning') return null;
    const nextState = assertAgentTransition(locked.state, 'message.required');
    const updated = await AgentRepository.updateRun(locked.id, locked.version, {
      state: nextState,
      questions: [],
      planArtifact: null,
    }, trx);
    await AgentRepository.addMessage(locked.id, 'assistant', buildPlanQualityFailureMessage(quality), {
      kind: 'planning_prompt',
      reason: 'plan_quality_failed',
      quality,
    }, trx);
    await AgentRepository.appendEvent({
      runId: locked.id,
      type: 'message.required',
      fromState: locked.state,
      toState: updated.state,
      actorType: 'worker',
      payload: { reason: 'plan_quality_failed', quality },
    }, trx);
    return updated;
  });
  await publishAgentRunUpdate(updatedRun);
  return updatedRun;
}

export async function completeWorkerPlanning(runId: number, artifact: AgentPlanArtifact, decision: AgentPlanningDecision) {
  const updatedRun = await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(runId, trx);
    if (!locked || locked.state !== 'planning') return null;
    const artifactWithQuality = artifact.quality
      ? artifact
      : attachPlanArtifactQuality({
          artifact,
          context: locked.planningContext,
          prompt: locked.prompt,
        });
    const nextState = assertAgentTransition(locked.state, 'plan.generated');
    const updated = await AgentRepository.updateRun(locked.id, locked.version, { state: nextState, planArtifact: artifactWithQuality, questions: [] }, trx);
    await AgentRepository.addMessage(locked.id, 'assistant', `Plan generated.\n\n${artifactWithQuality.summary}`, { kind: 'plan_summary', quality: artifactWithQuality.quality }, trx);
    await AgentRepository.appendEvent({ runId: locked.id, type: 'plan.generated', fromState: locked.state, toState: updated.state, actorType: 'worker', payload: { decision, quality: artifactWithQuality.quality } }, trx);
    return updated;
  });
  await publishAgentRunUpdate(updatedRun);
  return updatedRun;
}

export async function claimAgentRunForWork(runId: number) {
  const run = await AgentRepository.getRun(runId);
  if (!run || run.state !== 'queued') return null;
  return transitionRun({ runId, event: 'worker.claimed', actorType: 'worker' });
}

export async function deliverAgentDispatch(runId: number) {
  const run = await AgentRepository.getRun(runId);
  if (!run || run.state !== 'dispatching') return null;
  const updatedRun = await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(runId, trx);
    if (!locked || locked.state !== 'dispatching') return;
    const nextState = assertAgentTransition(locked.state, 'dispatch.delivered');
    const updated = await AgentRepository.updateRun(locked.id, locked.version, { state: nextState }, trx);
    await AgentRepository.markOutboxPublished(locked.id, trx);
    await AgentRepository.appendEvent({ runId: locked.id, type: 'dispatch.delivered', fromState: locked.state, toState: updated.state, actorType: 'worker' }, trx);
    return updated;
  });
  await publishAgentRunUpdate(updatedRun ?? null);
  return AgentRepository.getRun(runId);
}

export async function failAgentRun(runId: number, message: string, payload?: Record<string, unknown> | null) {
  const run = await AgentRepository.getRun(runId);
  if (!run || ['completed', 'cancelled'].includes(run.state)) return null;
  return transitionRun({ runId, event: 'run.failed', actorType: 'worker', update: { failureMessage: message }, payload: payload ?? null });
}

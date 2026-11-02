// Creates and lists project-scoped architecture runs on the shared durable agent runtime.
import db from '@/lib/db/db';
import { AgentRepository } from '@/lib/agents/infrastructure/repository';
import { architectureAgentIntents, type ArchitectureAgentIntent, type ArchitectureAgentTarget } from './contracts';
import { requireProjectMember } from '@/lib/utils/authorization';
import { BadRequestError } from '@/lib/utils/apiErrors';
import { ArchitectureRequirements } from '@/lib/models/architectureRequirements';
import { ArchitectureChangeSets } from './changeSets';
import { architectureDiscoveryQuestions, requirementFromAnswer } from './requirements';
import type { AgentClarificationAnswer } from '@/lib/agents/domain';

function normalizeIntent(value: string | undefined): ArchitectureAgentIntent {
  if (!value || !architectureAgentIntents.includes(value as ArchitectureAgentIntent)) return 'bootstrap';
  return value as ArchitectureAgentIntent;
}

export async function createArchitectureAgentRun(input: {
  organizationId: number;
  projectId: number;
  userId: number;
  prompt: string;
  intent?: string;
  target?: ArchitectureAgentTarget | null;
}) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  const prompt = input.prompt.trim();
  if (!prompt) throw new BadRequestError('Architecture agent prompt is required');
  const intent = normalizeIntent(input.intent);
  const run = await db.transaction(async (trx) => {
    const created = await AgentRepository.createProjectRun({
      organizationId: input.organizationId,
      projectId: input.projectId,
      createdBy: input.userId,
      architectureIntent: intent,
      targetContext: input.target || null,
      title: `${intent.replaceAll('_', ' ')}: ${prompt.slice(0, 80)}`,
      prompt,
    }, trx);
    await AgentRepository.appendEvent({ runId: created.id, type: 'run.created', fromState: null, toState: 'queued', actorType: 'user', actorId: input.userId, payload: { intent, target: input.target || null } }, trx);
    await AgentRepository.addMessage(created.id, 'user', prompt, { intent, target: input.target || null }, trx);
    await AgentRepository.enqueueJob(created.id, 'prepare', trx);
    return created;
  });
  return run;
}

export async function listArchitectureAgentRuns(input: { organizationId: number; projectId: number; userId: number }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  return AgentRepository.listProjectRuns(input.organizationId, input.projectId);
}

// Returns a project-scoped run with durable messages and state events for progress inspection.
export async function getArchitectureAgentRun(input: { organizationId: number; projectId: number; runId: number; userId: number }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  const run = await AgentRepository.getRun(input.runId);
  if (!run || run.organizationId !== input.organizationId || run.projectId !== input.projectId) throw new BadRequestError('Architecture agent run not found');
  return { run, changeSet: await ArchitectureChangeSets.getByRun(input.runId), events: await AgentRepository.listEvents(input.runId), messages: await AgentRepository.listMessages(input.runId), toolCalls: await AgentRepository.listToolCalls(input.runId) };
}

// Lists the project run event log so reconnecting clients can recover durable progress.
export async function listArchitectureAgentRunEvents(input: { organizationId: number; projectId: number; runId: number; userId: number }) {
  const detail = await getArchitectureAgentRun(input);
  return detail.events;
}

// Applies accessible discovery answers to first-class requirements and queues the next architecture turn.
export async function submitArchitectureDiscoveryAnswers(input: { organizationId: number; projectId: number; runId: number; userId: number; answers: AgentClarificationAnswer[] }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  const run = await AgentRepository.getRun(input.runId);
  if (!run || run.projectId !== input.projectId || run.state !== 'awaiting_input') throw new BadRequestError('This architecture run is not awaiting discovery answers');
  if (input.answers.length !== architectureDiscoveryQuestions.length) throw new BadRequestError('Answer every architecture discovery question before continuing');
  const answersByKey = new Map(input.answers.map((answer) => [answer.questionKey, answer]));
  const updated = await db.transaction(async (trx) => {
    const locked = await AgentRepository.lockRun(run.id, trx);
    if (!locked || locked.version !== run.version) throw new BadRequestError('Architecture run changed; refresh before answering');
    for (const question of architectureDiscoveryQuestions) {
      const answer = answersByKey.get(question.questionKey);
      if (!answer) throw new BadRequestError(`Missing answer for ${question.questionKey}`);
      const selected = answer.selectedOptionKey || answer.selectedOptionKeys?.[0];
      if (!selected || !question.options.some((option) => option.optionKey === selected)) throw new BadRequestError(`Invalid answer for ${question.questionKey}`);
      const requirement = requirementFromAnswer(question, answer);
      await ArchitectureRequirements.upsert({ project_id: input.projectId, ...requirement, created_by: input.userId }, trx);
    }
    const next = await AgentRepository.updateRun(locked.id, locked.version, { state: 'queued', questions: [], planningContext: { ...locked.planningContext, knownRequirements: architectureDiscoveryQuestions.map((question) => question.requirementTitle), blockingUnknowns: [], unresolvedUnknowns: [] } }, trx);
    await AgentRepository.addMessage(locked.id, 'user', 'Architecture discovery answers submitted.', { kind: 'architecture_discovery_answers', answers: input.answers }, trx);
    await AgentRepository.appendEvent({ runId: locked.id, type: 'input.submitted', fromState: locked.state, toState: next.state, actorType: 'user', actorId: input.userId, payload: { requirementCount: architectureDiscoveryQuestions.length } }, trx);
    await AgentRepository.enqueueJob(locked.id, 'prepare', trx);
    return next;
  });
  return updated;
}

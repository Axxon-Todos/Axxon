// Creates and lists project-scoped architecture runs on the shared durable agent runtime.
import db from '@/lib/db/db';
import { AgentRepository } from '@/lib/agents/infrastructure/repository';
import { architectureAgentIntents, type ArchitectureAgentIntent, type ArchitectureAgentTarget } from './contracts';
import { requireProjectMember } from '@/lib/utils/authorization';
import { BadRequestError } from '@/lib/utils/apiErrors';

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

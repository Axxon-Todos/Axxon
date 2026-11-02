// Coordinates authorized architecture discussions, realtime event persistence, and @Axxon runs.
import db from '@/lib/db/db';
import type { Knex } from 'knex';
import { createArchitectureAgentRun } from './runService';
import { ArchitectureCollaboration } from '@/lib/models/architectureCollaboration';
import { publishProjectUpdate } from '@/lib/wsServer';
import { requireProjectMember } from '@/lib/utils/authorization';
import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';

// Extracts normalized mention handles without treating email-like text as an agent mention.
export function extractArchitectureMentions(body: string) {
  return [...body.matchAll(/(^|\s)@(Axxon|[a-zA-Z0-9_.-]+)/g)].map((match) => match[2]);
}

async function publishCollaboration(projectId: number, event: { id: number; event_type: string; payload: Record<string, unknown> }) {
  try {
    await publishProjectUpdate(projectId, { type: `project:collaboration:${event.event_type}`, payload: { ...event.payload, eventId: event.id } });
  } catch (error) {
    console.error('[ARCHITECTURE_COLLABORATION_REALTIME_ERROR]', error);
  }
}

async function assertAnchor(projectId: number, componentId?: string | null, relationshipId?: string | null) {
  if (!componentId && !relationshipId) throw new BadRequestError('A comment must target a component or relationship');
  if (componentId && !(await db('architecture_components').where({ project_id: projectId, id: componentId }).first())) throw new NotFoundError('Architecture component not found');
  if (relationshipId && !(await db('architecture_relationships').where({ project_id: projectId, id: relationshipId }).first())) throw new NotFoundError('Architecture relationship not found');
}

// Prevents revision and agent-run anchors from crossing project boundaries.
async function assertContextAnchors(projectId: number, revisionId?: number | null, proposalRunId?: number | null) {
  if (revisionId && !(await db('architecture_revisions').where({ id: revisionId, project_id: projectId }).first())) throw new NotFoundError('Architecture revision not found');
  if (proposalRunId && !(await db('agent_runs').where({ id: proposalRunId, project_id: projectId }).first())) throw new NotFoundError('Architecture agent run not found');
}

// Creates the optional scoped architecture run using the caller's transaction.
async function createMentionedRun(input: {
  organizationId: number;
  projectId: number;
  userId: number;
  body: string;
  mentions: string[];
  target: { componentId?: string; relationshipId?: string; revisionId?: number; commentThreadId: number };
  trx: Knex.Transaction;
}) {
  if (!input.mentions.some((mention) => mention.toLowerCase() === 'axxon')) return null;
  return createArchitectureAgentRun({
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    intent: 'propose_change',
    prompt: input.body.replace(/@Axxon/gi, '').trim() || 'Review this architecture discussion and recommend the next change.',
    target: input.target,
    transaction: input.trx,
  });
}

// Lists authorized project discussions for a workspace.
export async function listArchitectureThreads(input: { organizationId: number; projectId: number; userId: number; status?: string }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  return ArchitectureCollaboration.listThreads(input.projectId, input.status);
}

// Creates an anchored thread and its initial comment in one transaction.
export async function createArchitectureThread(input: { organizationId: number; projectId: number; userId: number; body: string; componentId?: string | null; relationshipId?: string | null; revisionId?: number | null; proposalRunId?: number | null }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  const body = input.body.trim();
  if (!body || body.length > 4000) throw new BadRequestError('Comment must be between 1 and 4000 characters');
  await assertAnchor(input.projectId, input.componentId, input.relationshipId);
  await assertContextAnchors(input.projectId, input.revisionId, input.proposalRunId);
  const mentions = extractArchitectureMentions(body);
  const result = await db.transaction(async (trx) => {
    const thread = await ArchitectureCollaboration.createThread({ projectId: input.projectId, componentId: input.componentId, relationshipId: input.relationshipId, revisionId: input.revisionId, proposalRunId: input.proposalRunId, createdBy: input.userId }, trx);
    const comment = await ArchitectureCollaboration.addComment(thread.id, input.userId, body, mentions, 'human', trx);
    const events = [await ArchitectureCollaboration.appendEvent(input.projectId, input.userId, 'thread.created', { thread, comment }, trx)];
    const run = await createMentionedRun({ organizationId: input.organizationId, projectId: input.projectId, userId: input.userId, body, mentions, target: { componentId: input.componentId || undefined, relationshipId: input.relationshipId || undefined, revisionId: input.revisionId || undefined, commentThreadId: thread.id }, trx });
    if (run) events.push(await ArchitectureCollaboration.appendEvent(input.projectId, input.userId, 'agent.run.created', { threadId: thread.id, runId: run.id }, trx));
    return { thread: { ...thread, comments: [comment] }, events, run };
  });
  for (const event of result.events) await publishCollaboration(input.projectId, event);
  return { ...result.thread, agentRun: result.run };
}

// Appends a reply and starts a scoped Axxon run when the reply mentions the agent.
export async function addArchitectureComment(input: { organizationId: number; projectId: number; threadId: number; userId: number; body: string }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  const body = input.body.trim();
  if (!body || body.length > 4000) throw new BadRequestError('Comment must be between 1 and 4000 characters');
  const mentions = extractArchitectureMentions(body);
  const result = await db.transaction(async (trx) => {
    const thread = await ArchitectureCollaboration.getThread(input.projectId, input.threadId, trx);
    if (!thread) throw new NotFoundError('Comment thread not found');
    const comment = await ArchitectureCollaboration.addComment(thread.id, input.userId, body, mentions, 'human', trx);
    const events = [await ArchitectureCollaboration.appendEvent(input.projectId, input.userId, 'comment.created', { threadId: thread.id, comment }, trx)];
    const run = await createMentionedRun({ organizationId: input.organizationId, projectId: input.projectId, userId: input.userId, body, mentions, target: { componentId: thread.component_id || undefined, relationshipId: thread.relationship_id || undefined, revisionId: thread.revision_id || undefined, commentThreadId: thread.id }, trx });
    if (run) events.push(await ArchitectureCollaboration.appendEvent(input.projectId, input.userId, 'agent.run.created', { threadId: thread.id, runId: run.id }, trx));
    return { comment, events, run };
  });
  for (const event of result.events) await publishCollaboration(input.projectId, event);
  return { comment: result.comment, agentRun: result.run };
}

// Resolves or reopens a thread while retaining its full historical discussion.
export async function resolveArchitectureThread(input: { organizationId: number; projectId: number; threadId: number; userId: number; resolved: boolean }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  const { thread, event } = await db.transaction(async (trx) => {
    const updatedThread = await ArchitectureCollaboration.setResolved(input.projectId, input.threadId, input.resolved, input.userId, trx);
    if (!updatedThread) throw new NotFoundError('Comment thread not found');
    const auditEvent = await ArchitectureCollaboration.appendEvent(input.projectId, input.userId, input.resolved ? 'thread.resolved' : 'thread.reopened', { threadId: updatedThread.id, thread: updatedThread }, trx);
    return { thread: updatedThread, event: auditEvent };
  });
  await publishCollaboration(input.projectId, event);
  return thread;
}

// Returns authorized collaboration events after a client cursor for reconnect backfill.
export async function listArchitectureCollaborationEvents(input: { organizationId: number; projectId: number; userId: number; afterId?: number; limit?: number }) {
  await requireProjectMember(input.organizationId, input.projectId, input.userId);
  return ArchitectureCollaboration.listEvents(input.projectId, input.afterId || 0, input.limit || 100);
}

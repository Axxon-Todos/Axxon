// Persists authorized architecture discussions and the event stream used for realtime replay.
import db from '@/lib/db/db';
import type { Knex } from 'knex';
import type { ArchitectureCollaborationEvent, ArchitectureComment, ArchitectureCommentThread } from '@/lib/types/architectureCollaborationTypes';

type ThreadInput = {
  projectId: number;
  componentId?: string | null;
  relationshipId?: string | null;
  revisionId?: number | null;
  proposalRunId?: number | null;
  createdBy: number;
};

function mapThread(row: Record<string, unknown>, comments?: ArchitectureComment[]) {
  return { ...row, comments } as unknown as ArchitectureCommentThread;
}

export class ArchitectureCollaboration {
  // Lists project threads and their append-only comments in chronological order.
  static async listThreads(projectId: number, status?: string) {
    const query = db('architecture_comment_threads').where({ project_id: projectId }).orderBy('updated_at', 'desc');
    if (status === 'open' || status === 'resolved') query.andWhere({ status });
    const threads = await query;
    if (!threads.length) return [] as ArchitectureCommentThread[];
    const comments = await db('architecture_comments').whereIn('thread_id', threads.map((thread) => thread.id)).orderBy('created_at', 'asc');
    return threads.map((thread) => mapThread(thread, comments.filter((comment) => comment.thread_id === thread.id) as ArchitectureComment[]));
  }

  // Loads one thread after enforcing project ownership at the service boundary.
  static async getThread(projectId: number, threadId: number) {
    const thread = await db('architecture_comment_threads').where({ id: threadId, project_id: projectId }).first();
    if (!thread) return undefined;
    const comments = await db('architecture_comments').where({ thread_id: threadId }).orderBy('created_at', 'asc');
    return mapThread(thread, comments as ArchitectureComment[]);
  }

  // Creates an anchored discussion thread in the supplied transaction.
  static async createThread(input: ThreadInput, trx: Knex | Knex.Transaction = db) {
    const [thread] = await trx('architecture_comment_threads').insert({
      project_id: input.projectId,
      component_id: input.componentId || null,
      relationship_id: input.relationshipId || null,
      revision_id: input.revisionId || null,
      proposal_run_id: input.proposalRunId || null,
      created_by: input.createdBy,
      updated_at: trx.fn.now(),
    }).returning('*');
    return mapThread(thread);
  }

  // Appends a human or agent comment and updates the thread timestamp atomically.
  static async addComment(threadId: number, authorId: number, body: string, mentions: string[], authorType: 'human' | 'agent' = 'human', trx: Knex | Knex.Transaction = db) {
    const [comment] = await trx('architecture_comments').insert({ thread_id: threadId, author_id: authorId, author_type: authorType, body, mentions }).returning('*');
    await trx('architecture_comment_threads').where({ id: threadId }).update({ updated_at: trx.fn.now() });
    return comment as ArchitectureComment;
  }

  // Changes thread resolution without deleting historical discussion content.
  static async setResolved(projectId: number, threadId: number, resolved: boolean, userId: number) {
    const [thread] = await db('architecture_comment_threads').where({ id: threadId, project_id: projectId }).update({ status: resolved ? 'resolved' : 'open', resolved_by: resolved ? userId : null, resolved_at: resolved ? db.fn.now() : null, updated_at: db.fn.now() }).returning('*');
    return thread ? mapThread(thread) : undefined;
  }

  // Writes an event with a monotonic project-scoped cursor for reconnect backfill.
  static async appendEvent(projectId: number, actorId: number | null, eventType: string, payload: Record<string, unknown>, trx?: Knex.Transaction) {
    const executor = trx || db;
    const [event] = await executor('architecture_collaboration_events').insert({ project_id: projectId, actor_id: actorId, event_type: eventType, payload }).returning('*');
    return event as ArchitectureCollaborationEvent;
  }

  // Returns events after a cursor so reconnecting clients can replay missed collaboration changes.
  static async listEvents(projectId: number, afterId = 0, limit = 100) {
    const events = await db('architecture_collaboration_events').where({ project_id: projectId }).andWhere('id', '>', afterId).orderBy('id', 'asc').limit(Math.min(Math.max(limit, 1), 250));
    return events as ArchitectureCollaborationEvent[];
  }
}

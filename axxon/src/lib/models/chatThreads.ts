// Persists creator-owned org AI chat threads and creator-scoped thread lookups.
import db from '@/lib/db/db';
import type { OrganizationAiChatThread } from '@/lib/types/organizationAiChatTypes';
import type { Knex } from 'knex';

type DbExecutor = Knex | Knex.Transaction;

export class ChatThreads {
  static async createThread(
    {
      organizationId,
      createdBy,
      title,
      summary,
    }: {
      organizationId: number;
      createdBy: number;
      title: string;
      summary: string;
    },
    trx: DbExecutor = db
  ): Promise<OrganizationAiChatThread> {
    const [thread] = await trx('chat_threads')
      .insert({
        organization_id: organizationId,
        created_by: createdBy,
        title,
        summary,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    return thread;
  }

  static async listThreadsForUser({
    organizationId,
    userId,
  }: {
    organizationId: number;
    userId: number;
  }): Promise<OrganizationAiChatThread[]> {
    return db('chat_threads')
      .where({
        organization_id: organizationId,
        created_by: userId,
      })
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc');
  }

  static async getThreadById(
    threadId: number,
    trx: DbExecutor = db
  ): Promise<OrganizationAiChatThread | null> {
    return (
      (await trx('chat_threads').where({ id: threadId }).first()) ?? null
    );
  }

  static async lockThreadById(
    threadId: number,
    trx: Knex.Transaction
  ): Promise<OrganizationAiChatThread | null> {
    return (
      (await trx('chat_threads').where({ id: threadId }).forUpdate().first()) ??
      null
    );
  }

  static async touchThread(
    threadId: number,
    trx: DbExecutor = db
  ): Promise<void> {
    await trx('chat_threads').where({ id: threadId }).update({
      updated_at: db.fn.now(),
    });
  }
}

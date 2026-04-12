// Persists append-only org AI chat messages and ordered transcript reconstruction per thread.
import db from '@/lib/db/db';
import type {
  OrganizationAiChatMessage,
  OrganizationAiChatMessageRole,
  OrganizationAiChatMessageStatus,
} from '@/lib/types/organizationAiChatTypes';
import type { Knex } from 'knex';

type DbExecutor = Knex | Knex.Transaction;

export class ChatMessages {
  static async listMessagesForThread(
    threadId: number,
    trx: DbExecutor = db
  ): Promise<OrganizationAiChatMessage[]> {
    return trx('chat_messages')
      .where({ thread_id: threadId })
      .orderBy('sequence_number', 'asc')
      .orderBy('id', 'asc');
  }

  static async createMessage(
    {
      threadId,
      role,
      content,
      sequenceNumber,
      status,
      model,
    }: {
      threadId: number;
      role: OrganizationAiChatMessageRole;
      content: string;
      sequenceNumber: number;
      status: OrganizationAiChatMessageStatus;
      model?: string | null;
    },
    trx: DbExecutor = db
  ): Promise<OrganizationAiChatMessage> {
    const [message] = await trx('chat_messages')
      .insert({
        thread_id: threadId,
        role,
        content,
        sequence_number: sequenceNumber,
        status,
        model: model ?? null,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    return message;
  }

  static async getNextSequenceNumber(
    threadId: number,
    trx: DbExecutor = db
  ): Promise<number> {
    const latestMessage = await trx('chat_messages')
      .where({ thread_id: threadId })
      .orderBy('sequence_number', 'desc')
      .first<{ sequence_number: number }>('sequence_number');

    return (latestMessage?.sequence_number ?? 0) + 1;
  }
}

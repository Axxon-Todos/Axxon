// Persists append-only planning session transcript messages separate from structured planner state.
import db from '@/lib/db/db';
import type {
  PlanningSessionMessage,
  PlanningSessionMessageKind,
  PlanningSessionMessageRole,
  PlanningSessionMessageStatus,
} from '@/lib/types/organizationAiPlanningTypes';
import type { Knex } from 'knex';

type DbExecutor = Knex | Knex.Transaction;

export class PlanningSessionMessages {
  static async getMessageById(
    messageId: number,
    trx: DbExecutor = db
  ): Promise<PlanningSessionMessage | null> {
    const message = await trx('planning_session_messages')
      .where({ id: messageId })
      .first<PlanningSessionMessage>();

    return message ?? null;
  }

  static async listMessagesForSession(
    sessionId: number,
    trx: DbExecutor = db
  ): Promise<PlanningSessionMessage[]> {
    return trx('planning_session_messages')
      .where({ session_id: sessionId })
      .orderBy('sequence_number', 'asc')
      .orderBy('id', 'asc');
  }

  static async createMessage(
    {
      sessionId,
      role,
      messageKind,
      content,
      sequenceNumber,
      status = 'pending',
      metadata = null,
    }: {
      sessionId: number;
      role: PlanningSessionMessageRole;
      messageKind: PlanningSessionMessageKind;
      content: string;
      sequenceNumber: number;
      status?: PlanningSessionMessageStatus;
      metadata?: Record<string, unknown> | null;
    },
    trx: DbExecutor = db
  ): Promise<PlanningSessionMessage> {
    const [message] = await trx('planning_session_messages')
      .insert({
        session_id: sessionId,
        role,
        message_kind: messageKind,
        content,
        sequence_number: sequenceNumber,
        status,
        metadata_json: metadata,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    return message;
  }

  static async getNextSequenceNumber(
    sessionId: number,
    trx: DbExecutor = db
  ): Promise<number> {
    const latestMessage = await trx('planning_session_messages')
      .where({ session_id: sessionId })
      .orderBy('sequence_number', 'desc')
      .first<{ sequence_number: number }>('sequence_number');

    return (latestMessage?.sequence_number ?? 0) + 1;
  }

  static async updateMessage(
    messageId: number,
    {
      messageKind,
      content,
      status,
      metadata,
    }: {
      messageKind?: PlanningSessionMessageKind;
      content?: string;
      status?: PlanningSessionMessageStatus;
      metadata?: Record<string, unknown> | null;
    },
    trx: DbExecutor = db
  ): Promise<PlanningSessionMessage | null> {
    const updatePayload: Record<string, unknown> = {
      updated_at: db.fn.now(),
    };

    if (messageKind) {
      updatePayload.message_kind = messageKind;
    }

    if (typeof content === 'string') {
      updatePayload.content = content;
    }

    if (status) {
      updatePayload.status = status;
    }

    if (metadata !== undefined) {
      updatePayload.metadata_json = metadata;
    }

    const [message] = await trx('planning_session_messages')
      .where({ id: messageId })
      .update(updatePayload)
      .returning('*');

    return message ?? null;
  }

  static async getLatestAssistantPlannerStatusMessage(
    sessionId: number,
    trx: DbExecutor = db
  ): Promise<PlanningSessionMessage | null> {
    const message = await trx('planning_session_messages')
      .where({
        session_id: sessionId,
        role: 'assistant',
        message_kind: 'planner_status',
      })
      .orderBy('sequence_number', 'desc')
      .orderBy('id', 'desc')
      .first<PlanningSessionMessage>();

    return message ?? null;
  }

  static async claimLatestProcessableAssistantMessage(
    sessionId: number,
    staleBefore: Date,
    trx: Knex.Transaction
  ): Promise<PlanningSessionMessage | null> {
    const message = await trx('planning_session_messages')
      .where({ session_id: sessionId })
      .orderBy('sequence_number', 'desc')
      .orderBy('id', 'desc')
      .forUpdate()
      .first<PlanningSessionMessage>();

    if (!message) {
      return null;
    }

    if (message.role !== 'assistant' || message.message_kind !== 'planner_status') {
      return null;
    }

    if (!['pending', 'processing', 'failed'].includes(message.status)) {
      return null;
    }

    if (
      message.status === 'processing' &&
      new Date(message.updated_at).getTime() > staleBefore.getTime()
    ) {
      return null;
    }

    const [claimedMessage] = await trx('planning_session_messages')
      .where({ id: message.id })
      .update({
        status: 'processing',
        updated_at: db.fn.now(),
      })
      .returning('*');

    return claimedMessage ?? null;
  }
}

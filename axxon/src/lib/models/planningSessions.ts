// Persists creator-owned board-bound AI planning sessions with structured planner state snapshots.
import db from '@/lib/db/db';
import type {
  PlanningContext,
  PlanningPlanArtifact,
  PlanningReadiness,
  PlanningSession,
  PlanningSessionState,
} from '@/lib/types/organizationAiPlanningTypes';
import type { Knex } from 'knex';

type DbExecutor = Knex | Knex.Transaction;

type PlanningSessionRecord = PlanningSession & {
  context_json: PlanningContext;
  readiness_json: PlanningReadiness;
  plan_artifact_json: PlanningPlanArtifact | null;
};

function mapPlanningSessionRecord(record: PlanningSessionRecord): PlanningSession {
  return {
    id: record.id,
    organization_id: record.organization_id,
    board_id: record.board_id,
    created_by: record.created_by,
    title: record.title,
    summary: record.summary,
    original_prompt: record.original_prompt,
    planner_state: record.planner_state,
    clarification_turn_count: record.clarification_turn_count,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export class PlanningSessions {
  static async createSession(
    {
      organizationId,
      boardId,
      createdBy,
      title,
      summary,
      originalPrompt,
      plannerState,
      context,
      readiness,
      clarificationTurnCount = 0,
      planArtifact = null,
    }: {
      organizationId: number;
      boardId: number;
      createdBy: number;
      title: string;
      summary: string;
      originalPrompt: string;
      plannerState: PlanningSessionState;
      context: PlanningContext;
      readiness: PlanningReadiness;
      clarificationTurnCount?: number;
      planArtifact?: PlanningPlanArtifact | null;
    },
    trx: DbExecutor = db
  ): Promise<PlanningSession> {
    const [session] = await trx('planning_sessions')
      .insert({
        organization_id: organizationId,
        board_id: boardId,
        created_by: createdBy,
        title,
        summary,
        original_prompt: originalPrompt,
        planner_state: plannerState,
        context_json: context,
        readiness_json: readiness,
        clarification_turn_count: clarificationTurnCount,
        plan_artifact_json: planArtifact,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    return mapPlanningSessionRecord(session);
  }

  static async listSessionsForUser({
    organizationId,
    boardId,
    userId,
  }: {
    organizationId: number;
    boardId: number;
    userId: number;
  }): Promise<PlanningSession[]> {
    const rows = await db('planning_sessions')
      .where({
        organization_id: organizationId,
        board_id: boardId,
        created_by: userId,
      })
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc');

    return rows.map((row) => mapPlanningSessionRecord(row));
  }

  static async getSessionById(
    sessionId: number,
    trx: DbExecutor = db
  ): Promise<PlanningSessionRecord | null> {
    return (
      ((await trx('planning_sessions').where({ id: sessionId }).first()) as PlanningSessionRecord | undefined) ??
      null
    );
  }

  static async lockSessionById(
    sessionId: number,
    trx: Knex.Transaction
  ): Promise<PlanningSessionRecord | null> {
    return (
      ((await trx('planning_sessions')
        .where({ id: sessionId })
        .forUpdate()
        .first()) as PlanningSessionRecord | undefined) ?? null
    );
  }

  static async updateSession(
    sessionId: number,
    {
      title,
      summary,
      plannerState,
      context,
      readiness,
      clarificationTurnCount,
      planArtifact,
    }: {
      title?: string;
      summary?: string;
      plannerState?: PlanningSessionState;
      context?: PlanningContext;
      readiness?: PlanningReadiness;
      clarificationTurnCount?: number;
      planArtifact?: PlanningPlanArtifact | null;
    },
    trx: DbExecutor = db
  ): Promise<void> {
    const updatePayload: Record<string, unknown> = {
      updated_at: db.fn.now(),
    };

    if (typeof title === 'string') {
      updatePayload.title = title;
    }

    if (typeof summary === 'string') {
      updatePayload.summary = summary;
    }

    if (plannerState) {
      updatePayload.planner_state = plannerState;
    }

    if (context) {
      updatePayload.context_json = context;
    }

    if (readiness) {
      updatePayload.readiness_json = readiness;
    }

    if (typeof clarificationTurnCount === 'number') {
      updatePayload.clarification_turn_count = clarificationTurnCount;
    }

    if (planArtifact !== undefined) {
      updatePayload.plan_artifact_json = planArtifact;
    }

    await trx('planning_sessions').where({ id: sessionId }).update(updatePayload);
  }

  static mapSession(record: PlanningSessionRecord): PlanningSession {
    return mapPlanningSessionRecord(record);
  }
}

// Persists planning execution runs so async executor progress is tracked independently from transcript messages.
import db from '@/lib/db/db';
import type {
  PlanningExecutorKind,
  PlanningRun,
  PlanningRunStage,
  PlanningRunState,
} from '@/lib/types/organizationAiPlanningTypes';
import type { Knex } from 'knex';

type DbExecutor = Knex | Knex.Transaction;

type PlanningRunRecord = PlanningRun;

function mapPlanningRunRecord(record: PlanningRunRecord): PlanningRun {
  return {
    id: record.id,
    session_id: record.session_id,
    trigger_message_id: record.trigger_message_id,
    status_message_id: record.status_message_id,
    executor_kind: record.executor_kind,
    state: record.state,
    stage: record.stage,
    attempt_count: record.attempt_count,
    provider_job_id: record.provider_job_id,
    metadata_json: record.metadata_json,
    error_message: record.error_message,
    started_at: record.started_at,
    finished_at: record.finished_at,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export class PlanningRuns {
  static async createRun(
    {
      sessionId,
      triggerMessageId,
      statusMessageId,
      executorKind,
      state = 'queued',
      stage = 'queued',
      attemptCount = 0,
      providerJobId = null,
      metadata = null,
      errorMessage = null,
      startedAt = null,
      finishedAt = null,
    }: {
      sessionId: number;
      triggerMessageId: number;
      statusMessageId: number;
      executorKind: PlanningExecutorKind;
      state?: PlanningRunState;
      stage?: PlanningRunStage;
      attemptCount?: number;
      providerJobId?: string | null;
      metadata?: Record<string, unknown> | null;
      errorMessage?: string | null;
      startedAt?: string | Date | null;
      finishedAt?: string | Date | null;
    },
    trx: DbExecutor = db
  ): Promise<PlanningRun> {
    const [run] = await trx('planning_runs')
      .insert({
        session_id: sessionId,
        trigger_message_id: triggerMessageId,
        status_message_id: statusMessageId,
        executor_kind: executorKind,
        state,
        stage,
        attempt_count: attemptCount,
        provider_job_id: providerJobId,
        metadata_json: metadata,
        error_message: errorMessage,
        started_at: startedAt,
        finished_at: finishedAt,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    return mapPlanningRunRecord(run);
  }

  static async getRunById(
    runId: number,
    trx: DbExecutor = db
  ): Promise<PlanningRunRecord | null> {
    return (
      ((await trx('planning_runs').where({ id: runId }).first()) as
        | PlanningRunRecord
        | undefined) ?? null
    );
  }

  static async lockRunById(
    runId: number,
    trx: Knex.Transaction
  ): Promise<PlanningRunRecord | null> {
    return (
      ((await trx('planning_runs')
        .where({ id: runId })
        .forUpdate()
        .first()) as PlanningRunRecord | undefined) ?? null
    );
  }

  static async getLatestRunForSession(
    sessionId: number,
    trx: DbExecutor = db
  ): Promise<PlanningRunRecord | null> {
    return (
      ((await trx('planning_runs')
        .where({ session_id: sessionId })
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .first()) as PlanningRunRecord | undefined) ?? null
    );
  }

  static async updateRun(
    runId: number,
    {
      state,
      stage,
      attemptCount,
      providerJobId,
      metadata,
      errorMessage,
      startedAt,
      finishedAt,
    }: {
      state?: PlanningRunState;
      stage?: PlanningRunStage;
      attemptCount?: number;
      providerJobId?: string | null;
      metadata?: Record<string, unknown> | null;
      errorMessage?: string | null;
      startedAt?: string | Date | null;
      finishedAt?: string | Date | null;
    },
    trx: DbExecutor = db
  ): Promise<PlanningRun | null> {
    const updatePayload: Record<string, unknown> = {
      updated_at: db.fn.now(),
    };

    if (state) {
      updatePayload.state = state;
    }

    if (stage) {
      updatePayload.stage = stage;
    }

    if (typeof attemptCount === 'number') {
      updatePayload.attempt_count = attemptCount;
    }

    if (providerJobId !== undefined) {
      updatePayload.provider_job_id = providerJobId;
    }

    if (metadata !== undefined) {
      updatePayload.metadata_json = metadata;
    }

    if (errorMessage !== undefined) {
      updatePayload.error_message = errorMessage;
    }

    if (startedAt !== undefined) {
      updatePayload.started_at = startedAt;
    }

    if (finishedAt !== undefined) {
      updatePayload.finished_at = finishedAt;
    }

    const [run] = await trx('planning_runs')
      .where({ id: runId })
      .update(updatePayload)
      .returning('*');

    return run ? mapPlanningRunRecord(run) : null;
  }

  static async mapRun(record: PlanningRunRecord): Promise<PlanningRun> {
    return mapPlanningRunRecord(record);
  }
}

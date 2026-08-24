// Persists agent runs, append-only state events, durable jobs, and dispatch outbox records.
import type { Knex } from 'knex';
import db from '@/lib/db/db';
import type {
  AgentActorType,
  AgentPlanArtifact,
  AgentPlanningContext,
  AgentPlanningReadiness,
  AgentQuestion,
  AgentRun,
  AgentRunEvent,
  AgentRunEventType,
  AgentRunState,
  AgentRunType,
  AgentToolCall,
  AgentToolCallStatus,
} from '../domain';
import { createEmptyPlanningContext, createInitialPlanningReadiness } from '../domain';

type DbExecutor = Knex | Knex.Transaction;

type AgentRunRow = {
  id: number;
  organization_id: number;
  board_id: number;
  created_by: number;
  run_type: AgentRunType;
  title: string;
  prompt: string;
  state: AgentRunState;
  version: number;
  questions_json: AgentQuestion[] | string;
  planning_context_json: AgentPlanningContext | string;
  readiness_json: AgentPlanningReadiness | string;
  clarification_turn_count: number;
  plan_artifact_json: AgentPlanArtifact | string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
};

type AgentToolCallRow = {
  id: number;
  run_id: number;
  tool_name: string;
  status: AgentToolCallStatus;
  reason_code: AgentToolCall['reasonCode'];
  input_json: Record<string, unknown> | string;
  result_json: Record<string, unknown> | string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

function parseJson<T>(value: T | string | null, fallback: T): T {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    organizationId: row.organization_id,
    boardId: row.board_id,
    createdBy: row.created_by,
    runType: row.run_type ?? 'planning',
    title: row.title,
    prompt: row.prompt,
    state: row.state,
    version: row.version,
    questions: parseJson(row.questions_json, []),
    planningContext: parseJson(row.planning_context_json, createEmptyPlanningContext()),
    readiness: parseJson(row.readiness_json, createInitialPlanningReadiness()),
    clarificationTurnCount: Number(row.clarification_turn_count ?? 0),
    planArtifact: parseJson(row.plan_artifact_json, null),
    failureMessage: row.failure_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapToolCall(row: AgentToolCallRow): AgentToolCall {
  return {
    id: row.id,
    runId: row.run_id,
    toolName: row.tool_name,
    status: row.status,
    reasonCode: row.reason_code,
    input: parseJson(row.input_json, {}),
    result: parseJson(row.result_json, null),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function mapEvent(row: Record<string, unknown>): AgentRunEvent {
  return {
    id: Number(row.id),
    runId: Number(row.run_id),
    type: row.event_type as AgentRunEventType,
    fromState: row.from_state as AgentRunState | null,
    toState: row.to_state as AgentRunState,
    actorType: row.actor_type as AgentActorType,
    actorId: row.actor_id == null ? null : Number(row.actor_id),
    payload: parseJson(row.payload_json as string | Record<string, unknown> | null, null),
    createdAt: String(row.created_at),
  };
}

export class AgentRepository {
  static async createRun(
    input: { organizationId: number; boardId: number; createdBy: number; runType: AgentRunType; title: string; prompt: string },
    trx: DbExecutor = db
  ) {
    const [row] = await trx('agent_runs').insert({
      organization_id: input.organizationId,
      board_id: input.boardId,
      created_by: input.createdBy,
      run_type: input.runType,
      title: input.title,
      prompt: input.prompt,
      state: 'queued',
      version: 1,
      questions_json: JSON.stringify([]),
      planning_context_json: createEmptyPlanningContext(),
      readiness_json: createInitialPlanningReadiness(),
      clarification_turn_count: 0,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    }).returning('*');
    return mapRun(row as AgentRunRow);
  }

  static async getRun(runId: number, trx: DbExecutor = db) {
    const row = await trx('agent_runs').where({ id: runId }).first<AgentRunRow>();
    return row ? mapRun(row) : null;
  }

  static async lockRun(runId: number, trx: Knex.Transaction) {
    const row = await trx('agent_runs').where({ id: runId }).forUpdate().first<AgentRunRow>();
    return row ? mapRun(row) : null;
  }

  static async listBoardRuns(organizationId: number, boardId: number) {
    const rows = await db('agent_runs').where({ organization_id: organizationId, board_id: boardId })
      .orderBy('updated_at', 'desc').orderBy('id', 'desc');
    return rows.map((row) => mapRun(row as AgentRunRow));
  }

  static async updateRun(
    runId: number,
    version: number,
    update: Partial<Pick<AgentRun, 'state' | 'questions' | 'planningContext' | 'readiness' | 'clarificationTurnCount' | 'planArtifact' | 'failureMessage'>>,
    trx: DbExecutor = db
  ) {
    const payload: Record<string, unknown> = { version: version + 1, updated_at: db.fn.now() };
    if (update.state) payload.state = update.state;
    if (update.questions !== undefined) payload.questions_json = JSON.stringify(update.questions);
    if (update.planningContext) payload.planning_context_json = update.planningContext;
    if (update.readiness) payload.readiness_json = update.readiness;
    if (typeof update.clarificationTurnCount === 'number') payload.clarification_turn_count = update.clarificationTurnCount;
    if (update.planArtifact !== undefined) payload.plan_artifact_json = update.planArtifact;
    if (update.failureMessage !== undefined) payload.failure_message = update.failureMessage;
    const [row] = await trx('agent_runs').where({ id: runId, version }).update(payload).returning('*');
    if (!row) throw new Error('Agent run changed concurrently');
    return mapRun(row as AgentRunRow);
  }

  static async appendEvent(
    input: { runId: number; type: AgentRunEventType; fromState: AgentRunState | null; toState: AgentRunState; actorType: AgentActorType; actorId?: number | null; payload?: Record<string, unknown> | null },
    trx: DbExecutor = db
  ) {
    const [row] = await trx('agent_run_events').insert({
      run_id: input.runId,
      event_type: input.type,
      from_state: input.fromState,
      to_state: input.toState,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      payload_json: input.payload ?? null,
      created_at: db.fn.now(),
    }).returning('*');
    return mapEvent(row as Record<string, unknown>);
  }

  static async listEvents(runId: number, trx: DbExecutor = db) {
    const rows = await trx('agent_run_events').where({ run_id: runId }).orderBy('id', 'asc');
    return rows.map((row) => mapEvent(row as Record<string, unknown>));
  }

  static async createToolCall(
    input: {
      runId: number;
      toolName: string;
      status: AgentToolCallStatus;
      reasonCode: AgentToolCall['reasonCode'];
      toolInput: Record<string, unknown>;
      result?: Record<string, unknown> | null;
      errorMessage?: string | null;
    },
    trx: DbExecutor = db
  ) {
    const [row] = await trx('agent_tool_calls').insert({
      run_id: input.runId,
      tool_name: input.toolName,
      status: input.status,
      reason_code: input.reasonCode,
      input_json: input.toolInput,
      result_json: input.result ?? null,
      error_message: input.errorMessage ?? null,
      created_at: db.fn.now(),
      completed_at: db.fn.now(),
    }).returning('*');
    return mapToolCall(row as AgentToolCallRow);
  }

  static async listToolCalls(runId: number, trx: DbExecutor = db) {
    const rows = await trx('agent_tool_calls').where({ run_id: runId }).orderBy('id', 'asc');
    return rows.map((row) => mapToolCall(row as AgentToolCallRow));
  }

  static async addMessage(runId: number, role: string, content: string, metadata: Record<string, unknown> | null, trx: DbExecutor = db) {
    await trx('agent_run_messages').insert({ run_id: runId, role, content, metadata_json: metadata, created_at: db.fn.now() });
  }

  static async listMessages(runId: number, trx: DbExecutor = db) {
    return trx('agent_run_messages').where({ run_id: runId }).orderBy('id', 'asc');
  }

  static async enqueueJob(runId: number, kind: 'prepare' | 'dispatch', trx: DbExecutor = db) {
    const [row] = await trx('agent_jobs').insert({ run_id: runId, kind, state: 'queued', available_at: db.fn.now(), created_at: db.fn.now(), updated_at: db.fn.now() }).returning('*');
    return row;
  }

  static async claimJob(workerId: string, trx: Knex.Transaction) {
    const row = await trx('agent_jobs').where({ state: 'queued' }).where('available_at', '<=', db.fn.now())
      .orderBy('id', 'asc').forUpdate().skipLocked().first();
    if (!row) return null;
    const [job] = await trx('agent_jobs').where({ id: row.id, state: 'queued' }).update({
      state: 'running', locked_by: workerId, locked_at: db.fn.now(), attempt_count: Number(row.attempt_count) + 1, updated_at: db.fn.now(),
    }).returning('*');
    return job ?? null;
  }

  static async requeueStaleJobs(staleBefore: Date, trx: DbExecutor = db) {
    await trx('agent_jobs').where({ state: 'running' }).where('locked_at', '<', staleBefore).update({
      state: 'queued', locked_at: null, locked_by: null, updated_at: db.fn.now(),
    });
  }

  static async finishJob(jobId: number, errorMessage: string | null, trx: DbExecutor = db) {
    await trx('agent_jobs').where({ id: jobId }).update({ state: errorMessage ? 'failed' : 'completed', error_message: errorMessage, finished_at: db.fn.now(), updated_at: db.fn.now() });
  }

  static async createOutboxEvent(runId: number, payload: Record<string, unknown>, trx: DbExecutor = db) {
    await trx('agent_outbox_events').insert({ run_id: runId, type: 'agent.dispatch.requested', payload_json: payload, state: 'pending', created_at: db.fn.now(), updated_at: db.fn.now() });
  }

  static async markOutboxPublished(runId: number, trx: DbExecutor = db) {
    await trx('agent_outbox_events').where({ run_id: runId, state: 'pending' }).update({ state: 'published', attempt_count: db.raw('attempt_count + 1'), published_at: db.fn.now(), updated_at: db.fn.now() });
  }
}

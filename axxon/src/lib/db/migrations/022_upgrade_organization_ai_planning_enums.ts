// Upgrades planning enum types in-place so existing development databases accept the persisted processing states.
import type { Knex } from 'knex';

export const config = {
  transaction: false,
};

const PLANNING_SESSION_STATE = 'planning_session_state';
const PLANNING_SESSION_MESSAGE_STATUS = 'planning_session_message_status';

async function addEnumValueIfMissing(
  knex: Knex,
  enumName: string,
  value: string
) {
  await knex.raw(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`);
}

async function enumHasValue(knex: Knex, enumName: string, value: string) {
  const result = await knex('pg_type')
    .join('pg_enum', 'pg_type.oid', 'pg_enum.enumtypid')
    .where('pg_type.typname', enumName)
    .where('pg_enum.enumlabel', value)
    .first('pg_enum.enumlabel');

  return Boolean(result);
}

export async function up(knex: Knex): Promise<void> {
  const hasPlanningSessionsTable = await knex.schema.hasTable('planning_sessions');
  const hasPlanningSessionMessagesTable = await knex.schema.hasTable(
    'planning_session_messages'
  );

  if (hasPlanningSessionsTable) {
    await addEnumValueIfMissing(knex, PLANNING_SESSION_STATE, 'analyzing');
    await addEnumValueIfMissing(knex, PLANNING_SESSION_STATE, 'failed');

    if (await enumHasValue(knex, PLANNING_SESSION_STATE, 'collecting_intent')) {
      await knex('planning_sessions')
        .where({ planner_state: 'collecting_intent' })
        .update({ planner_state: 'analyzing' });
    }

    if (await enumHasValue(knex, PLANNING_SESSION_STATE, 'ready_to_plan')) {
      await knex('planning_sessions')
        .where({ planner_state: 'ready_to_plan' })
        .update({ planner_state: 'planning' });
    }

    await knex.raw(
      `ALTER TABLE "planning_sessions" ALTER COLUMN "planner_state" SET DEFAULT 'analyzing'`
    );
  }

  if (hasPlanningSessionMessagesTable) {
    await addEnumValueIfMissing(knex, PLANNING_SESSION_MESSAGE_STATUS, 'pending');
    await addEnumValueIfMissing(knex, PLANNING_SESSION_MESSAGE_STATUS, 'processing');

    await knex.raw(
      `ALTER TABLE "planning_session_messages" ALTER COLUMN "status" SET DEFAULT 'pending'`
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasPlanningSessionsTable = await knex.schema.hasTable('planning_sessions');
  const hasPlanningSessionMessagesTable = await knex.schema.hasTable(
    'planning_session_messages'
  );

  if (hasPlanningSessionsTable) {
    if (await enumHasValue(knex, PLANNING_SESSION_STATE, 'analyzing')) {
      await knex('planning_sessions')
        .where({ planner_state: 'analyzing' })
        .update({ planner_state: 'clarifying' });
    }

    if (await enumHasValue(knex, PLANNING_SESSION_STATE, 'failed')) {
      await knex('planning_sessions')
        .where({ planner_state: 'failed' })
        .update({ planner_state: 'clarifying' });
    }

    await knex.raw(
      `ALTER TABLE "planning_sessions" ALTER COLUMN "planner_state" SET DEFAULT 'clarifying'`
    );
  }

  if (hasPlanningSessionMessagesTable) {
    await knex('planning_session_messages')
      .where({ status: 'pending' })
      .update({ status: 'completed' });

    await knex('planning_session_messages')
      .where({ status: 'processing' })
      .update({ status: 'completed' });

    await knex.raw(
      `ALTER TABLE "planning_session_messages" ALTER COLUMN "status" SET DEFAULT 'completed'`
    );
  }
}

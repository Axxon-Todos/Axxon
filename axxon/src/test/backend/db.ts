import db from '@/lib/db/db';

export const TEST_TABLES = [
  'architecture_collaboration_events',
  'architecture_comments',
  'architecture_comment_threads',
  'architecture_view_nodes',
  'architecture_views',
  'architecture_relationships',
  'architecture_components',
  'architecture_drafts',
  'architecture_revisions',
  'architecture_requirements',
  'architecture_requirement_links',
  'architecture_change_sets',
  'projects',
  'agent_tool_calls',
  'agent_outbox_events',
  'agent_jobs',
  'agent_run_messages',
  'agent_run_events',
  'agent_runs',
  'planning_runs',
  'planning_session_questions',
  'planning_session_messages',
  'planning_sessions',
  'github_webhook_events',
  'repositories',
  'github_installations',
  'chat_messages',
  'chat_threads',
  'messages',
  'conversation_members',
  'conversations',
  'todo_labels',
  'todos',
  'sprints',
  'labels',
  'categories',
  'board_members',
  'boards',
  'organization_members',
  'organizations',
  'users',
];

export async function resetDatabase() {
  const existingTables = await db('information_schema.tables')
    .where({ table_schema: 'public' })
    .whereIn('table_name', TEST_TABLES)
    .pluck<string[]>('table_name');
  const tablesToTruncate = TEST_TABLES.filter((tableName) => existingTables.includes(tableName));

  if (tablesToTruncate.length === 0) {
    return;
  }

  await db.raw(`TRUNCATE TABLE ${tablesToTruncate.join(', ')} RESTART IDENTITY CASCADE`);
}

export { db };

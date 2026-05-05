import db from '@/lib/db/db';

export const TEST_TABLES = [
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
  await db.raw(`TRUNCATE TABLE ${TEST_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

export { db };

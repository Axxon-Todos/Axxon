import db from '@/lib/db/db';

export const TEST_TABLES = [
  'messages',
  'conversation_members',
  'conversations',
  'todo_labels',
  'todos',
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

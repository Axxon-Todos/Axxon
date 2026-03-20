import db from '@/lib/db/db';

let userSequence = 1;
let organizationSequence = 1;
let boardSequence = 1;
let categorySequence = 1;
let labelSequence = 1;
let todoSequence = 1;
let conversationSequence = 1;

export async function createUser(overrides: Partial<Record<'first_name' | 'last_name' | 'email' | 'avatar_url', string | null>> = {}) {
  const sequence = userSequence++;
  const [user] = await db('users')
    .insert({
      first_name: overrides.first_name ?? `Test${sequence}`,
      last_name: overrides.last_name ?? 'User',
      email: overrides.email ?? `user${sequence}@example.com`,
      avatar_url: overrides.avatar_url ?? null,
    })
    .returning('*');

  return user;
}

export async function createOrganizationRecord({
  createdBy,
  name,
  description = null,
  color = '#0f766e',
}: {
  createdBy: number;
  name?: string;
  description?: string | null;
  color?: string | null;
}) {
  const sequence = organizationSequence++;
  const [organization] = await db('organizations')
    .insert({
      name: name ?? `Organization ${sequence}`,
      description,
      color,
      created_by: createdBy,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  await db('organization_members').insert({
    organization_id: organization.id,
    user_id: createdBy,
    role: 'owner',
    created_at: db.fn.now(),
  });

  return organization;
}

export async function addOrganizationMember(
  organizationId: number,
  userId: number,
  role: 'owner' | 'member' = 'member'
) {
  const [membership] = await db('organization_members')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      role,
      created_at: db.fn.now(),
    })
    .returning('*');

  return membership;
}

export async function createBoardRecord({
  createdBy,
  organizationId,
  name,
  color = '#2563eb',
}: {
  createdBy: number;
  organizationId?: number;
  name?: string;
  color?: string;
}) {
  const sequence = boardSequence++;
  const resolvedOrganizationId =
    organizationId ?? (await createOrganizationRecord({ createdBy })).id;
  const [board] = await db('boards')
    .insert({
      name: name ?? `Board ${sequence}`,
      organization_id: resolvedOrganizationId,
      created_by: createdBy,
      color,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  return board;
}

export async function addBoardMember(boardId: number, userId: number) {
  const [membership] = await db('board_members')
    .insert({
      board_id: boardId,
      user_id: userId,
    })
    .returning('*');

  return membership;
}

export async function createCategoryRecord({
  boardId,
  name,
  color = '#94a3b8',
  position = 0,
  isDone = false,
}: {
  boardId: number;
  name?: string;
  color?: string;
  position?: number;
  isDone?: boolean;
}) {
  const sequence = categorySequence++;
  const [category] = await db('categories')
    .insert({
      board_id: boardId,
      name: name ?? `Category ${sequence}`,
      color,
      position,
      is_done: isDone,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  return category;
}

export async function createLabelRecord({
  boardId,
  name,
  color = '#f97316',
}: {
  boardId: number;
  name?: string;
  color?: string;
}) {
  const sequence = labelSequence++;
  const [label] = await db('labels')
    .insert({
      board_id: boardId,
      name: name ?? `Label ${sequence}`,
      color,
    })
    .returning('*');

  return label;
}

export async function createTodoRecord({
  boardId,
  categoryId,
  title,
  description = null,
  dueDate = null,
  assigneeId = null,
  priority = 2,
  isComplete = false,
}: {
  boardId: number;
  categoryId: number;
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  assigneeId?: number | null;
  priority?: number | null;
  isComplete?: boolean;
}) {
  const sequence = todoSequence++;
  const [todo] = await db('todos')
    .insert({
      board_id: boardId,
      category_id: categoryId,
      title: title ?? `Todo ${sequence}`,
      description,
      due_date: dueDate,
      assignee_id: assigneeId,
      priority,
      is_complete: isComplete,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  return todo;
}

export async function addTodoLabel(todoId: number, labelId: number) {
  const [todoLabel] = await db('todo_labels')
    .insert({
      todo_id: todoId,
      label_id: labelId,
    })
    .returning('*');

  return todoLabel;
}

export async function createConversationRecord({
  boardId,
  isGroup = true,
  title,
}: {
  boardId: number;
  isGroup?: boolean;
  title?: string | null;
}) {
  const sequence = conversationSequence++;
  const [conversation] = await db('conversations')
    .insert({
      board_id: boardId,
      is_group: isGroup,
      title: title ?? `Conversation ${sequence}`,
      created_at: db.fn.now(),
    })
    .returning('*');

  return conversation;
}

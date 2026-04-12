import db from '@/lib/db/db';

let userSequence = 1;
let organizationSequence = 1;
let boardSequence = 1;
let categorySequence = 1;
let labelSequence = 1;
let todoSequence = 1;
let sprintSequence = 1;
let conversationSequence = 1;
let githubInstallationSequence = 1;
let githubRepositorySequence = 1;
let chatThreadSequence = 1;
let chatMessageSequence = 1;

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
  sprintId = null,
  title,
  description = null,
  dueDate = null,
  assigneeId = null,
  priority = 2,
  isComplete = false,
}: {
  boardId: number;
  categoryId: number;
  sprintId?: number | null;
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
      sprint_id: sprintId,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  return todo;
}

export async function createSprintRecord({
  boardId,
  name,
  description = null,
  startDate = '2030-01-01',
  endDate = '2030-01-14',
  color = '#2563eb',
  icon = 'flag',
  archivedAt = null,
}: {
  boardId: number;
  name?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string;
  color?: string | null;
  icon?: string | null;
  archivedAt?: string | null;
}) {
  const sequence = sprintSequence++;
  const [sprint] = await db('sprints')
    .insert({
      board_id: boardId,
      name: name ?? `Sprint ${sequence}`,
      description,
      start_date: startDate,
      end_date: endDate,
      color,
      icon,
      archived_at: archivedAt,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  return sprint;
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

export async function createChatThreadRecord({
  organizationId,
  createdBy,
  title,
  summary,
}: {
  organizationId: number;
  createdBy: number;
  title?: string;
  summary?: string;
}) {
  const sequence = chatThreadSequence++;
  const [thread] = await db('chat_threads')
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      title: title ?? `Thread ${sequence}`,
      summary: summary ?? `Summary ${sequence}`,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  return thread;
}

export async function createChatMessageRecord({
  threadId,
  role,
  content,
  sequenceNumber,
  status = 'completed',
  model = null,
}: {
  threadId: number;
  role: 'user' | 'assistant';
  content?: string;
  sequenceNumber?: number;
  status?: 'completed' | 'failed';
  model?: string | null;
}) {
  const sequence = chatMessageSequence++;
  const resolvedSequenceNumber = sequenceNumber ?? sequence;
  const [message] = await db('chat_messages')
    .insert({
      thread_id: threadId,
      role,
      content: content ?? `Chat message ${sequence}`,
      sequence_number: resolvedSequenceNumber,
      status,
      model,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  return message;
}

export async function createGitHubInstallationRecord({
  organizationId,
  installedByUserId = null,
  githubInstallationId,
  githubAccountId,
  githubAccountLogin,
  githubAccountType = 'Organization',
  repositorySelection = 'all',
  status = 'active',
}: {
  organizationId: number;
  installedByUserId?: number | null;
  githubInstallationId?: string;
  githubAccountId?: string;
  githubAccountLogin?: string;
  githubAccountType?: string;
  repositorySelection?: 'all' | 'selected';
  status?: 'pending' | 'active' | 'suspended' | 'removed';
}) {
  const sequence = githubInstallationSequence++;
  const [installation] = await db('github_installations')
    .insert({
      organization_id: organizationId,
      github_installation_id: githubInstallationId ?? String(1000 + sequence),
      github_account_id: githubAccountId ?? String(2000 + sequence),
      github_account_login: githubAccountLogin ?? `axxon-installation-${sequence}`,
      github_account_type: githubAccountType,
      repository_selection: repositorySelection,
      status,
      installed_by_user_id: installedByUserId,
      last_synced_at: null,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  return installation;
}

export async function createRepositoryRecord({
  organizationId,
  githubInstallationId,
  githubRepoId,
  name,
  fullName,
  ownerLogin,
  defaultBranch = 'main',
  isPrivate = true,
  archived = false,
  htmlUrl,
  isActive = true,
}: {
  organizationId: number;
  githubInstallationId: string;
  githubRepoId?: string;
  name?: string;
  fullName?: string;
  ownerLogin?: string;
  defaultBranch?: string | null;
  isPrivate?: boolean;
  archived?: boolean;
  htmlUrl?: string;
  isActive?: boolean;
}) {
  const sequence = githubRepositorySequence++;
  const resolvedOwnerLogin = ownerLogin ?? 'axxon-test';
  const resolvedName = name ?? `repo-${sequence}`;
  const [repository] = await db('repositories')
    .insert({
      organization_id: organizationId,
      github_installation_id: githubInstallationId,
      github_repo_id: githubRepoId ?? String(3000 + sequence),
      name: resolvedName,
      full_name: fullName ?? `${resolvedOwnerLogin}/${resolvedName}`,
      owner_login: resolvedOwnerLogin,
      default_branch: defaultBranch,
      private: isPrivate,
      archived,
      html_url: htmlUrl ?? `https://github.com/${resolvedOwnerLogin}/${resolvedName}`,
      is_active: isActive,
      raw_json: null,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  return repository;
}

export async function createBoardRepositoryAccessRecord({
  boardId,
  repositoryId,
}: {
  boardId: number;
  repositoryId: number;
}) {
  const [record] = await db('board_repository_access')
    .insert({
      board_id: boardId,
      repository_id: repositoryId,
      created_at: db.fn.now(),
    })
    .returning('*');

  return record;
}

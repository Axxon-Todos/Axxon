// Seeds the development database with org-first demo data, boards, and related workspace records.
import type { Knex } from 'knex';

type SeedUser = {
  id: number;
  email: string;
};

type SeedOrganization = {
  id: number;
  name: string;
  created_by: number;
};

type SeedBoard = {
  id: number;
  name: string;
  created_by: number;
  organization_id: number;
};

type SeedCategory = {
  id: number;
  board_id: number;
};

type SeedLabel = {
  id: number;
  board_id: number;
};

const RESET_TABLES = [
  'github_webhook_events',
  'board_repository_access',
  'repositories',
  'github_installations',
  'message_attachments',
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

const USER_SEEDS = [
  {
    first_name: 'Xavier',
    last_name: 'Campos',
    email: 'xaviercampos2425@gmail.com',
    avatar_url: null,
  },
  {
    first_name: 'Alice',
    last_name: 'Johnson',
    email: 'alice.johnson@example.com',
    avatar_url: null,
  },
  {
    first_name: 'Bob',
    last_name: 'Smith',
    email: 'bob.smith@example.com',
    avatar_url: null,
  },
  {
    first_name: 'Carol',
    last_name: 'Williams',
    email: 'carol.williams@example.com',
    avatar_url: null,
  },
] as const;

const ORGANIZATION_SEEDS = [
  {
    name: 'Platform Command',
    description: 'Primary workspace for product planning, roadmap management, and board analytics.',
    color: '#0f766e',
  },
  {
    name: 'Agent Delivery',
    description: 'Delivery workspace for execution boards, sprint work, and release coordination.',
    color: '#14532d',
  },
] as const;

const BOARD_COLORS = ['#0F766E', '#15803D', '#0EA5A4', '#65A30D', '#1D4ED8', '#B45309'];

const CATEGORY_SEEDS = [
  { name: 'Backlog', color: '#94A3B8', is_done: false },
  { name: 'Todo', color: '#3B82F6', is_done: false },
  { name: 'In Progress', color: '#F59E0B', is_done: false },
  { name: 'Done', color: '#10B981', is_done: true },
  { name: 'Cancelled', color: '#EF4444', is_done: false },
] as const;

const LABEL_COLORS = ['#F97316', '#8B5CF6', '#14B8A6', '#EAB308', '#EC4899'];

const TOTAL_BOARD_COUNT = 100;
const TODOS_PER_CATEGORY = 4;

async function clearSeedData(knex: Knex) {
  await knex.raw(`TRUNCATE TABLE ${RESET_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

function getRequiredUserId(users: SeedUser[], email: string) {
  const user = users.find((candidate) => candidate.email === email);

  if (!user) {
    throw new Error(`Missing seeded user for email "${email}".`);
  }

  return user.id;
}

function buildBoardMemberIds({
  boardIndex,
  ownerId,
  xavierId,
  userIds,
}: {
  boardIndex: number;
  ownerId: number;
  xavierId: number;
  userIds: number[];
}) {
  const memberIds = new Set<number>([ownerId]);

  if (ownerId !== xavierId && boardIndex % 5 === 0) {
    memberIds.add(xavierId);
  }

  let offset = 1;
  while (memberIds.size < Math.min(4, userIds.length)) {
    const candidateUserId = userIds[(boardIndex + offset) % userIds.length];
    memberIds.add(candidateUserId);
    offset += 1;
  }

  return Array.from(memberIds);
}

function buildTodoDueDate(categoryIndex: number, todoIndex: number) {
  return new Date(Date.UTC(2030, 0, 1 + categoryIndex + todoIndex));
}

export async function seed(knex: Knex): Promise<void> {
  await clearSeedData(knex);

  const insertedUsers = (await knex('users')
    .insert(USER_SEEDS)
    .returning(['id', 'email'])) as SeedUser[];

  const xavierId = getRequiredUserId(insertedUsers, 'xaviercampos2425@gmail.com');
  const aliceId = getRequiredUserId(insertedUsers, 'alice.johnson@example.com');
  const userIds = insertedUsers.map((user) => user.id);

  const insertedOrganizations = (await knex('organizations')
    .insert([
      {
        ...ORGANIZATION_SEEDS[0],
        created_by: xavierId,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      },
      {
        ...ORGANIZATION_SEEDS[1],
        created_by: aliceId,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      },
    ])
    .returning(['id', 'name', 'created_by'])) as SeedOrganization[];

  const primaryOrganizationId = insertedOrganizations[0]?.id;
  const secondaryOrganizationId = insertedOrganizations[1]?.id;

  if (!primaryOrganizationId || !secondaryOrganizationId) {
    throw new Error('Expected both demo organizations to be created during seeding.');
  }

  await knex('organization_members').insert(
    insertedOrganizations.flatMap((organization) =>
      insertedUsers.map((user) => ({
        organization_id: organization.id,
        user_id: user.id,
        role: user.id === organization.created_by ? 'owner' : 'member',
        created_at: knex.fn.now(),
      }))
    )
  );

  const boardRows = Array.from({ length: TOTAL_BOARD_COUNT }, (_, index) => ({
    name: `Board ${index + 1}`,
    organization_id: index < 60 ? primaryOrganizationId : secondaryOrganizationId,
    created_by: index < 30 ? xavierId : insertedUsers[index % insertedUsers.length].id,
    color: BOARD_COLORS[index % BOARD_COLORS.length],
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  }));

  const insertedBoards = (await knex('boards')
    .insert(boardRows)
    .returning(['id', 'name', 'created_by', 'organization_id'])) as SeedBoard[];

  const boardIndexByName = new Map(boardRows.map((board, index) => [board.name, index]));

  await knex('board_members').insert(
    insertedBoards.flatMap((board) => {
      const boardIndex = boardIndexByName.get(board.name);

      if (boardIndex === undefined) {
        throw new Error(`Missing deterministic board index for "${board.name}".`);
      }

      return buildBoardMemberIds({
        boardIndex,
        ownerId: board.created_by,
        xavierId,
        userIds,
      }).map((userId) => ({
        board_id: board.id,
        user_id: userId,
      }));
    })
  );

  const categoryRows = insertedBoards.flatMap((board) =>
    CATEGORY_SEEDS.map((category, index) => ({
      board_id: board.id,
      name: category.name,
      color: category.color,
      position: index,
      is_done: category.is_done,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    }))
  );

  const insertedCategories = (await knex('categories')
    .insert(categoryRows)
    .returning(['id', 'board_id'])) as SeedCategory[];

  const labelRows = insertedBoards.flatMap((board) =>
    LABEL_COLORS.map((color, index) => ({
      board_id: board.id,
      name: `Label ${index + 1}`,
      color,
    }))
  );

  const insertedLabels = (await knex('labels')
    .insert(labelRows)
    .returning(['id', 'board_id'])) as SeedLabel[];

  const labelIdsByBoardId = new Map<number, number[]>();
  for (const label of insertedLabels) {
    const labelIds = labelIdsByBoardId.get(label.board_id) ?? [];
    labelIds.push(label.id);
    labelIdsByBoardId.set(label.board_id, labelIds);
  }

  const todos = insertedCategories.flatMap((category, categoryIndex) =>
    Array.from({ length: TODOS_PER_CATEGORY }, (_, todoIndex) => ({
      board_id: category.board_id,
      category_id: category.id,
      title: `Task ${todoIndex + 1} for Category ${category.id}`,
      description: `Auto-generated todo ${todoIndex + 1} under category ${category.id}.`,
      due_date: buildTodoDueDate(categoryIndex, todoIndex),
      assignee_id: userIds[(categoryIndex + todoIndex) % userIds.length],
      priority: (todoIndex % 3) + 1,
      is_complete: todoIndex === TODOS_PER_CATEGORY - 1,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    }))
  );

  const insertedTodos = await knex('todos')
    .insert(todos)
    .returning(['id', 'board_id']);

  const todoLabels = insertedTodos.flatMap((todo, todoIndex) => {
    const labelIds = labelIdsByBoardId.get(todo.board_id) ?? [];

    if (labelIds.length === 0) {
      return [];
    }

    const selectedLabelIds = [
      labelIds[todoIndex % labelIds.length],
      labelIds[(todoIndex + 1) % labelIds.length],
      ...(todoIndex % 3 === 0 ? [labelIds[(todoIndex + 2) % labelIds.length]] : []),
    ];

    return Array.from(new Set(selectedLabelIds)).map((labelId) => ({
      todo_id: todo.id,
      label_id: labelId,
    }));
  });

  await knex('todo_labels').insert(todoLabels);

  console.log(`🌱 Seed complete:
  - Users: ${insertedUsers.length}
  - Organizations: ${insertedOrganizations.length}
  - Organization members: ${insertedOrganizations.length * insertedUsers.length}
  - Boards: ${insertedBoards.length}
  - Categories: ${insertedCategories.length}
  - Labels: ${insertedLabels.length}
  - Todos: ${insertedTodos.length}
  - TodoLabels: ${todoLabels.length}`);
}

export async function rollbackSeed(knex: Knex): Promise<void> {
  await clearSeedData(knex);
  console.log('🌱 Rollback complete.');
}

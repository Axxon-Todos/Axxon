import { Todos } from '@/lib/models/todos';
import type { CreateTodoData, UpdateTodoData } from '@/lib/types/todoTypes';
import { publishBoardUpdate } from '@/lib/wsServer';
import { TodoLabels } from '@/lib/models/todoLabels';
import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';
import { requireBoardMember } from '@/lib/utils/authorization';

type CreateTodoPayload = Omit<CreateTodoData, 'board_id'>;

type UpdateTodoPayload = Partial<
  Pick<
    UpdateTodoData,
    'title' | 'description' | 'due_date' | 'assignee_id' | 'priority' | 'category_id' | 'is_complete'
  >
>;

type CreateTodoInput = {
  boardId: number;
  sessionUserId: number;
  data: CreateTodoPayload;
};

type ListTodosInput = {
  boardId: number;
  sessionUserId: number;
};

type UpdateTodoInput = {
  boardId: number;
  todoId: number;
  sessionUserId: number;
  data: UpdateTodoPayload;
};

type DeleteTodoInput = {
  boardId: number;
  todoId: number;
  sessionUserId: number;
};

type GetTodoByIdInput = {
  boardId: number;
  todoId: number;
  sessionUserId: number;
};

// Creates a todo in a board.
export async function createTodo({
  boardId,
  sessionUserId,
  data,
}: CreateTodoInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const todo = await Todos.createTodo({ ...data, board_id: boardId });

  // Publish the hydrated todo to keep realtime clients in sync.
  const fullTodo = await TodoLabels.getTodosWithLabels(boardId);
  const createdTodo = fullTodo.find(item => item.id === todo.id);

  if (createdTodo) {
    await publishBoardUpdate(String(boardId), {
      type: 'todo:created',
      payload: createdTodo,
    });
  }

  return todo;
}

// Lists todos in a board.
export async function listTodos({ boardId, sessionUserId }: ListTodosInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardMember(boardId, sessionUserId);
  return Todos.listTodosInBoard({ board_id: boardId });
}

// Updates a todo in a board.
export async function updateTodo({
  boardId,
  todoId,
  sessionUserId,
  data,
}: UpdateTodoInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(todoId)) {
    throw new BadRequestError('Invalid board or todo id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const allowedKeys: Array<keyof UpdateTodoPayload> = [
    'title',
    'description',
    'due_date',
    'assignee_id',
    'priority',
    'category_id',
    'is_complete',
  ];
  const filteredBody = Object.fromEntries(
    Object.entries(data ?? {}).filter(([key]) => allowedKeys.includes(key as keyof UpdateTodoPayload))
  );

  const updated = await Todos.updateTodo({ ...filteredBody, id: todoId, board_id: boardId });
  if (!updated) {
    throw new NotFoundError('Todo not found');
  }

  const fullTodo = await TodoLabels.getTodoByIdWithLabels(updated.id, boardId);

  await publishBoardUpdate(String(boardId), {
    type: 'todo:updated',
    payload: fullTodo,
  });

  return fullTodo;
}

// Deletes a todo from a board.
export async function deleteTodo({
  boardId,
  todoId,
  sessionUserId,
}: DeleteTodoInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(todoId)) {
    throw new BadRequestError('Invalid board or todo id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const deleted = await Todos.deleteTodo({ id: todoId, board_id: boardId });
  if (deleted === 0) {
    throw new NotFoundError('Todo not found');
  }

  await publishBoardUpdate(String(boardId), {
    type: 'todo:deleted',
    payload: { id: todoId },
  });

  return { deleted };
}

// Gets a single todo in a board.
export async function getTodoById({
  boardId,
  todoId,
  sessionUserId,
}: GetTodoByIdInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(todoId)) {
    throw new BadRequestError('Invalid board or todo id');
  }

  await requireBoardMember(boardId, sessionUserId);
  const todo = await Todos.getTodoById({ id: todoId, board_id: boardId });
  if (!todo) {
    throw new NotFoundError('Todo not found');
  }

  return todo;
}

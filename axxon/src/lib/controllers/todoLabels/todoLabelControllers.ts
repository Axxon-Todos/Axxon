import { TodoLabels } from '@/lib/models/todoLabels';
import type {
  AddLabelToTodo as AddLabelToTodoData,
  GetLabelsOnTodo,
  RemoveLabelFromTodo as RemoveLabelFromTodoData,
} from '@/lib/types/todoLabelTypes';
import { publishBoardUpdate } from '@/lib/wsServer';
import { Labels } from '@/lib/models/labels';
import { Todos } from '@/lib/models/todos';
import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';
import { requireBoardMember } from '@/lib/utils/authorization';

type TodoLabelRouteInput = {
  boardId: number;
  todoId: number;
  sessionUserId: number;
};

type AddLabelToTodoInput = TodoLabelRouteInput & {
  labelId: number;
};

type RemoveLabelFromTodoInput = TodoLabelRouteInput & {
  labelId: number;
};

// Adds a label to a todo in a board.
export async function addLabelToTodo({
  boardId,
  todoId,
  labelId,
  sessionUserId,
}: AddLabelToTodoInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(todoId) || !Number.isFinite(labelId)) {
    throw new BadRequestError('Invalid board, todo, or label id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const todo = await Todos.getTodoById({ id: todoId, board_id: boardId });
  if (!todo) {
    throw new NotFoundError('Todo not found');
  }

  const label = await Labels.getLabelById({ id: labelId, board_id: boardId });
  if (!label) {
    throw new NotFoundError('Label not found');
  }

  const data: AddLabelToTodoData = { todo_id: todoId, label_id: labelId };
  const todoLabel = await TodoLabels.addLabelToTodo(data);

  const updatedTodo = await TodoLabels.getTodoByIdWithLabels(todoId, boardId);
  await publishBoardUpdate(String(boardId), {
    type: 'todo:updated',
    payload: updatedTodo,
  });

  return todoLabel;
}


// Removes a label from a todo in a board.
export async function removeLabelFromTodo({
  boardId,
  todoId,
  labelId,
  sessionUserId,
}: RemoveLabelFromTodoInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(todoId) || !Number.isFinite(labelId)) {
    throw new BadRequestError('Invalid board, todo, or label id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const todo = await Todos.getTodoById({ id: todoId, board_id: boardId });
  if (!todo) {
    throw new NotFoundError('Todo not found');
  }

  const label = await Labels.getLabelById({ id: labelId, board_id: boardId });
  if (!label) {
    throw new NotFoundError('Label not found');
  }

  const data: RemoveLabelFromTodoData = { todo_id: todoId, label_id: labelId };
  const removed = await TodoLabels.removeLabelFromTodo(data);

  const updatedTodo = await TodoLabels.getTodoByIdWithLabels(todoId, boardId);
  await publishBoardUpdate(String(boardId), {
    type: 'todo:updated',
    payload: updatedTodo,
  });

  return { removed };
}

// Lists labels for a todo in a board.
export async function getTodoLabels({
  boardId,
  todoId,
  sessionUserId,
}: TodoLabelRouteInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(todoId)) {
    throw new BadRequestError('Invalid board or todo id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const todo = await Todos.getTodoById({ id: todoId, board_id: boardId });
  if (!todo) {
    throw new NotFoundError('Todo not found');
  }

  const data: GetLabelsOnTodo = { todo_id: todoId };
  return TodoLabels.getLabelsForTodo(data);
}

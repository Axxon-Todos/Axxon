import { deleteTodo, getTodoById, updateTodo } from '@/lib/controllers/todos/todoControllers';
import type { UpdateTodoData } from '@/lib/types/todoTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';
import { NextRequest, NextResponse } from 'next/server';

type TodoRouteParams = {
  organizationId: string;
  boardId: string;
  todoId: string;
};

type UpdateTodoPayload = Partial<
  Pick<
    UpdateTodoData,
    'title' | 'description' | 'due_date' | 'assignee_id' | 'priority' | 'category_id' | 'sprint_id' | 'is_complete'
  >
>;

export async function PATCH(req: NextRequest, context: RouteContext<TodoRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const { todoId } = await context.params;
    const data = await parseJsonBody<UpdateTodoPayload>(req);
    const todo = await updateTodo({
      boardId,
      todoId: parseNumericRouteParam(todoId, 'todo id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(todo, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[UPDATE_TODO_ERROR]', 'Failed to update todo');
  }
}

export async function DELETE(req: NextRequest, context: RouteContext<TodoRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const { todoId } = await context.params;
    const result = await deleteTodo({
      boardId,
      todoId: parseNumericRouteParam(todoId, 'todo id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[DELETE_TODO_ERROR]', 'Failed to delete todo');
  }
}

export async function GET(req: NextRequest, context: RouteContext<TodoRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const { todoId } = await context.params;
    const todo = await getTodoById({
      boardId,
      todoId: parseNumericRouteParam(todoId, 'todo id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(todo, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[GET_TODO_BY_ID_ERROR]', 'Failed to retrieve todo');
  }
}

import { createTodo, listTodos } from '@/lib/controllers/todos/todoControllers';
import type { CreateTodoData } from '@/lib/types/todoTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  RouteContext,
} from '@/lib/utils/apiRoute';
import { NextRequest, NextResponse } from 'next/server';

type TodoRouteParams = {
  boardId: string;
};

type CreateTodoPayload = Omit<CreateTodoData, 'board_id'>;

export async function POST(req: NextRequest, context: RouteContext<TodoRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const data = await parseJsonBody<CreateTodoPayload>(req);
    const todo = await createTodo({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_TODO_ERROR]', 'Failed to create todo');
  }
}

export async function GET(req: NextRequest, context: RouteContext<TodoRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const todos = await listTodos({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(todos, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[LIST_TODOS_ERROR]', 'Failed to list todos');
  }
}

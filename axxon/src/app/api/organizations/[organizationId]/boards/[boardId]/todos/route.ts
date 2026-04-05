import { createTodo, listTodos } from '@/lib/controllers/todos/todoControllers';
import type { CreateTodoData } from '@/lib/types/todoTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';
import { NextRequest, NextResponse } from 'next/server';

type TodoRouteParams = {
  organizationId: string;
  boardId: string;
};

type CreateTodoPayload = Omit<CreateTodoData, 'board_id'>;

export async function POST(req: NextRequest, context: RouteContext<TodoRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const data = await parseJsonBody<CreateTodoPayload>(req);
    const todo = await createTodo({
      boardId,
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
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const todos = await listTodos({
      boardId,
      sessionUserId: session.userId,
    });

    return NextResponse.json(todos, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[LIST_TODOS_ERROR]', 'Failed to list todos');
  }
}

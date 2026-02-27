import {
  addLabelToTodo,
  removeLabelFromTodo,
} from '@/lib/controllers/todoLabels/todoLabelControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, RouteContext } from '@/lib/utils/apiRoute';
import { NextRequest, NextResponse } from 'next/server';

type TodoLabelRouteParams = {
  boardId: string;
  todoId: string;
  labelId: string;
};

export async function POST(req: NextRequest, context: RouteContext<TodoLabelRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId, todoId, labelId } = await context.params;
    const todoLabel = await addLabelToTodo({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      todoId: parseNumericRouteParam(todoId, 'todo id'),
      labelId: parseNumericRouteParam(labelId, 'label id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(todoLabel, { status: 201 });
  } catch (error) {
    return handleApiError(error, '[ADD_LABEL_TO_TODO_ERROR]', 'Failed to add label to todo');
  }
}

export async function DELETE(req: NextRequest, context: RouteContext<TodoLabelRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId, todoId, labelId } = await context.params;
    const result = await removeLabelFromTodo({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      todoId: parseNumericRouteParam(todoId, 'todo id'),
      labelId: parseNumericRouteParam(labelId, 'label id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[REMOVE_LABEL_FROM_TODO_ERROR]', 'Failed to remove label from todo');
  }
}

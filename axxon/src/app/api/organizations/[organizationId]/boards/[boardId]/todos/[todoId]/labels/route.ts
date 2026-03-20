import { getTodoLabels } from '@/lib/controllers/todoLabels/todoLabelControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';
import { NextRequest, NextResponse } from 'next/server';

type TodoLabelRouteParams = {
  organizationId: string;
  boardId: string;
  todoId: string;
};

export async function GET(req: NextRequest, context: RouteContext<TodoLabelRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const { todoId } = await context.params;
    const labels = await getTodoLabels({
      boardId,
      todoId: parseNumericRouteParam(todoId, 'todo id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(labels, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[GET_LABELS_FOR_TODO_ERROR]', 'Failed to get labels for todo');
  }
}

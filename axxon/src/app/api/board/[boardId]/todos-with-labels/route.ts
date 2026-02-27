// src/app/api/board/[boardId]/todos-with-labels/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { TodoLabels } from '@/lib/models/todoLabels';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, RouteContext } from '@/lib/utils/apiRoute';
import { requireBoardMember } from '@/lib/utils/authorization';

type TodoWithLabelsRouteParams = {
  boardId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<TodoWithLabelsRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const parsedBoardId = parseNumericRouteParam(boardId, 'board id');

    await requireBoardMember(parsedBoardId, session.userId);

    const enrichedTodos = await TodoLabels.getTodosWithLabels(parsedBoardId);
    return NextResponse.json(enrichedTodos);
  } catch (error) {
    return handleApiError(error, '[GET_TODOS_WITH_LABELS_ERROR]', 'Failed to fetch todos with labels');
  }
}

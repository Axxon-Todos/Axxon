'use server';

import { NextRequest, NextResponse } from 'next/server';
import { TodoLabels } from '@/lib/models/todoLabels';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type TodoWithLabelsRouteParams = {
  organizationId: string;
  boardId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<TodoWithLabelsRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const enrichedTodos = await TodoLabels.getTodosWithLabels(boardId);
    return NextResponse.json(enrichedTodos);
  } catch (error) {
    return handleApiError(error, '[GET_TODOS_WITH_LABELS_ERROR]', 'Failed to fetch todos with labels');
  }
}

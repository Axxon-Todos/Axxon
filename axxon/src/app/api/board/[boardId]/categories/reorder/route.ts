// app/api/board/[boardId]/categories/reorder/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { reorderCategories } from '@/lib/controllers/categories/categoryControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  RouteContext,
} from '@/lib/utils/apiRoute';

type CategoryReorderRouteParams = {
  boardId: string;
};

type ReorderCategoriesPayload = {
  newOrder: number[];
};

export async function PATCH(req: NextRequest, context: RouteContext<CategoryReorderRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const data = await parseJsonBody<ReorderCategoriesPayload>(req);
    const result = await reorderCategories({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[REORDER_CATEGORIES_ERROR]', 'Failed to reorder categories');
  }
}

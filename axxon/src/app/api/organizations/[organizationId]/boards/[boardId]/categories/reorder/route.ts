import { NextRequest, NextResponse } from 'next/server';
import { reorderCategories } from '@/lib/controllers/categories/categoryControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type CategoryReorderRouteParams = {
  organizationId: string;
  boardId: string;
};

type ReorderCategoriesPayload = {
  newOrder: number[];
};

export async function PATCH(
  req: NextRequest,
  context: RouteContext<CategoryReorderRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const data = await parseJsonBody<ReorderCategoriesPayload>(req);
    const result = await reorderCategories({
      boardId,
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[REORDER_CATEGORIES_ERROR]', 'Failed to reorder categories');
  }
}

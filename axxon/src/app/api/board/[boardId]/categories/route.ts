import { NextRequest, NextResponse } from 'next/server';
import {
  createCategory,
  listCategories,
} from '@/lib/controllers/categories/categoryControllers';
import type { CreateCategory } from '@/lib/types/categoryTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  RouteContext,
} from '@/lib/utils/apiRoute';

type CategoryRouteParams = {
  boardId: string;
};

type CreateCategoryPayload = Omit<CreateCategory, 'board_id'>;

export async function POST(req: NextRequest, context: RouteContext<CategoryRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const data = await parseJsonBody<CreateCategoryPayload>(req);
    const category = await createCategory({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_CATEGORY_ERROR]', 'Failed to create category');
  }
}

export async function GET(req: NextRequest, context: RouteContext<CategoryRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const categories = await listCategories({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(categories, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[LIST_CATEGORIES_ERROR]', 'Failed to display categories');
  }
}

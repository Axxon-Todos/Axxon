import { NextRequest, NextResponse } from 'next/server';
import {
  deleteCategory,
  getCategoryById,
  updateCategory,
} from '@/lib/controllers/categories/categoryControllers';
import type { UpdateCategory } from '@/lib/types/categoryTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  RouteContext,
} from '@/lib/utils/apiRoute';

type CategoryRouteParams = {
  boardId: string;
  categoryId: string;
};

type UpdateCategoryPayload = Partial<Pick<UpdateCategory, 'name' | 'color' | 'position' | 'is_done'>>;

export async function GET(req: NextRequest, context: RouteContext<CategoryRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId, categoryId } = await context.params;
    const category = await getCategoryById({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      categoryId: parseNumericRouteParam(categoryId, 'category id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(category, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[GET_CATEGORY_BY_ID_ERROR]', 'Failed to retrieve category');
  }
}

export async function PATCH(req: NextRequest, context: RouteContext<CategoryRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId, categoryId } = await context.params;
    const data = await parseJsonBody<UpdateCategoryPayload>(req);
    const category = await updateCategory({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      categoryId: parseNumericRouteParam(categoryId, 'category id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(category, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[UPDATE_CATEGORY_ERROR]', 'Failed to update category');
  }
}

export async function DELETE(req: NextRequest, context: RouteContext<CategoryRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId, categoryId } = await context.params;
    const result = await deleteCategory({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      categoryId: parseNumericRouteParam(categoryId, 'category id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[DELETE_CATEGORY_ERROR]', 'Failed to delete category');
  }
}

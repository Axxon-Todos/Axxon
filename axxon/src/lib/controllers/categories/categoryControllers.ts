import { Categories } from '@/lib/models/categories';
import type { CreateCategory, UpdateCategory } from '@/lib/types/categoryTypes';
import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';
import { requireBoardMember } from '@/lib/utils/authorization';

type CreateCategoryPayload = Omit<CreateCategory, 'board_id'>;

type UpdateCategoryPayload = Partial<Pick<UpdateCategory, 'name' | 'color' | 'position' | 'is_done'>>;

type ReorderCategoriesPayload = {
  newOrder: number[];
};

type CreateCategoryInput = {
  boardId: number;
  sessionUserId: number;
  data: CreateCategoryPayload;
};

type UpdateCategoryInput = {
  boardId: number;
  categoryId: number;
  sessionUserId: number;
  data: UpdateCategoryPayload;
};

type DeleteCategoryInput = {
  boardId: number;
  categoryId: number;
  sessionUserId: number;
};

type ListCategoriesInput = {
  boardId: number;
  sessionUserId: number;
};

type ReorderCategoriesInput = {
  boardId: number;
  sessionUserId: number;
  data: ReorderCategoriesPayload;
};

type GetCategoryByIdInput = {
  boardId: number;
  categoryId: number;
  sessionUserId: number;
};

function throwCategoryRuleError(error: unknown, messages: string[]) {
  if (
    error instanceof Error &&
    messages.some(message => error.message.includes(message))
  ) {
    throw new BadRequestError(error.message);
  }
}

// Creates a category in a board.
export async function createCategory({
  boardId,
  sessionUserId,
  data,
}: CreateCategoryInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardMember(boardId, sessionUserId);

  try {
    const categoryData: CreateCategory = { ...data, board_id: boardId };
    return await Categories.createCategory(categoryData);
  } catch (error) {
    throwCategoryRuleError(error, [
      'Maximum categories',
      'backlog category',
      'done categories',
    ]);
    throw error;
  }
}

// Updates a category in a board.
export async function updateCategory({
  boardId,
  categoryId,
  sessionUserId,
  data,
}: UpdateCategoryInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(categoryId)) {
    throw new BadRequestError('Invalid board or category id');
  }

  await requireBoardMember(boardId, sessionUserId);

  try {
    const allowedKeys: Array<keyof UpdateCategoryPayload> = ['name', 'color', 'position', 'is_done'];
    const filteredBody = Object.fromEntries(
      Object.entries(data ?? {}).filter(([key]) => allowedKeys.includes(key as keyof UpdateCategoryPayload))
    );

    const updateData: UpdateCategory = { ...filteredBody, id: categoryId, board_id: boardId };

    if (updateData.position === undefined || updateData.position === null) {
      delete updateData.position;
    }

    const updatedCategory = await Categories.updateCategory(updateData);
    if (!updatedCategory) {
      throw new NotFoundError('Category not found');
    }

    return updatedCategory;
  } catch (error) {
    throwCategoryRuleError(error, [
      'backlog category',
      'done categories',
      'Invalid position',
    ]);
    throw error;
  }
}

// Deletes a category from a board.
export async function deleteCategory({
  boardId,
  categoryId,
  sessionUserId,
}: DeleteCategoryInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(categoryId)) {
    throw new BadRequestError('Invalid board or category id');
  }

  await requireBoardMember(boardId, sessionUserId);

  try {
    const deleted = await Categories.deleteCategory({ id: categoryId, board_id: boardId });

    if (deleted === 0) {
      throw new NotFoundError('Category not found');
    }

    return { success: true };
  } catch (error) {
    throwCategoryRuleError(error, [
      'at least one backlog',
      'two categories',
      'cannot delete',
      'still has todos',
    ]);
    throw error;
  }
}

// Lists categories in a board.
export async function listCategories({ boardId, sessionUserId }: ListCategoriesInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid board id');
  }

  await requireBoardMember(boardId, sessionUserId);
  return Categories.listAllCategoriesInBoard({ board_id: boardId });
}

// Reorders categories in a board.
export async function reorderCategories({
  boardId,
  sessionUserId,
  data,
}: ReorderCategoriesInput) {
  if (!Number.isFinite(boardId)) {
    throw new BadRequestError('Missing or invalid boardId');
  }

  await requireBoardMember(boardId, sessionUserId);

  if (!Array.isArray(data.newOrder) || data.newOrder.length === 0) {
    throw new BadRequestError('Invalid newOrder payload');
  }

  await Categories.reorderCategories(boardId, data.newOrder);

  return { success: true };
}

// Gets a single category in a board.
export async function getCategoryById({
  boardId,
  categoryId,
  sessionUserId,
}: GetCategoryByIdInput) {
  if (!Number.isFinite(boardId) || !Number.isFinite(categoryId)) {
    throw new BadRequestError('Invalid board or category id');
  }

  await requireBoardMember(boardId, sessionUserId);

  const category = await Categories.getCategoryById({ id: categoryId, board_id: boardId });
  if (!category) {
    throw new NotFoundError('Category not found');
  }

  return category;
}

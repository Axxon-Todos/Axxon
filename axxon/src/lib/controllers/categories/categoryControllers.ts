import { NextRequest, NextResponse } from 'next/server';
import { Categories } from '@/lib/models/categories';
import type { CreateCategory, UpdateCategory } from '@/lib/types/categoryTypes';

// creates categories
export async function POST( req: NextRequest, context: { params: { boardId: string } }) {
  try {
    const board_id = Number(context.params.boardId);
    const body = await req.json();

    const data: CreateCategory = { ...body, board_id };

    const category = await Categories.createCategory(data);

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error('[CREATE_CATEGORY_ERROR]', error);

    // Business rule violations -> 400
    if (
      error.message.includes('Maximum categories') ||
      error.message.includes('backlog category') ||
      error.message.includes('done categories')
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

// updates categories
export async function PATCH( req: NextRequest, params: { boardId: string; categoryId: string }) {
  try {
    const board_id = Number(params.boardId);
    const id = Number(params.categoryId);

    const body = await req.json();

    // Only allow specific fields to be updated
    const allowedKeys: Array<keyof UpdateCategory> = ['name', 'color', 'position', 'is_done'];
    const filteredBody = Object.fromEntries(
      Object.entries(body).filter(([key]) => allowedKeys.includes(key as keyof UpdateCategory))
    );

    const data: UpdateCategory = { ...filteredBody, id, board_id };

    if (data.position === undefined || data.position === null) {
      delete data.position;
    }

    const updatedCategory = await Categories.updateCategory(data);

    return NextResponse.json(updatedCategory, { status: 200 });
  } catch (error: any) {
    console.error('[UPDATE_CATEGORY_ERROR]', error);

    // Business rule violations -> 400
    if (
      error.message.includes('backlog category') ||
      error.message.includes('done categories') ||
      error.message.includes('Invalid position')
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// Deletes categories
export async function DELETE( _req: NextRequest, params: { boardId: string; categoryId: string }) {
  try {
    const id = Number(params.categoryId);

    const deleted = await Categories.deleteCategory({ id });

    if (deleted === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[DELETE_CATEGORY_ERROR]', error);

    // Map known business rule errors -> 400
    if (
      error.message.includes('at least one backlog') || // safeguard from future rules
      error.message.includes('two categories') ||
      error.message.includes('cannot delete') ||
      error.message.includes('still has todos')
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });}

    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}

// lists out categories
export async function GET(_req: NextRequest, params: { boardId: string; }) {
  try{
    const board_id = Number(params.boardId);
    const categories = await Categories.listAllCategoriesInBoard({board_id});
    return NextResponse.json(categories, {status: 200});
  }catch(error){
    console.error('[LIST_CATEGORIES_ERROR]', error);
    return NextResponse.json({ error: 'Failed to display categories'},{status: 500});
  }
}

//Reorder Categories
export async function PATCH_reorder(req: NextRequest, params: { boardId: string }) {
  try {
    const board_id = Number(params.boardId);
    if (!board_id) {
      return NextResponse.json({ error: 'Missing or invalid boardId' }, { status: 400 });
    }

    const { newOrder } = await req.json();
    if (!Array.isArray(newOrder) || newOrder.length === 0) {
      return NextResponse.json({ error: 'Invalid newOrder payload' }, { status: 400 });
    }

    // Perform bulk reorder
    await Categories.reorderCategories(board_id, newOrder);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[REORDER_CATEGORIES_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to reorder categories' },
      { status: 500 }
    );
  }
}

// GetById
export async function getCategoryByIdController(_req: NextRequest, params: { boardId: string; categoryId: string }) {
  try {
    const id = Number(params.categoryId);

    const category = await Categories.getCategoryById({ id });

    return NextResponse.json(category, { status: 200 });
  } catch (error) {
    console.error('[GET_CATEGORY_BY_ID_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve category' }, { status: 500 });
  }
}

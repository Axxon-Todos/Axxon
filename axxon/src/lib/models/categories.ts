import knex from '@/lib/db/db';
import type { CategoryBaseData, CreateCategory, UpdateCategory, DeleteCategory, ListCategoriesForBoard, GetCategoryById } from '../types/categoryTypes';
import { getAvailableColor } from '../utils/colorPicker';

export class Categories {

  // -- HELPERS -- //
  static getCategoryCountForBoard = async (board_id: number): Promise<number> => {
    const result = await knex('categories')
      .where({ board_id })
      .count('*')
      .first();

    return Number(result?.count ?? 0);
  };

  static getCategoryById = async (data: GetCategoryById): Promise<CategoryBaseData | null> =>{
    return await knex('categories').where({id: data.id, board_id: data.board_id}).first() || null
  };

  // -- CRUD OPERATIONS -- //
  static createCategory = async (data: CreateCategory): Promise<CategoryBaseData> => {
    return await knex.transaction(async (trx) => {
      // Count total categories for this board
      const count = await trx('categories')
        .where({ board_id: data.board_id })
        .count<{ count: string }>('id as count')
        .first();

      const totalCategories = Number(count?.count ?? 0);

      // Enforce max 10 categories per board
      if (totalCategories >= 10) {
        throw new Error('Maximum categories reached (10)');
      }

      // First category must always be a backlog
      if (totalCategories === 0) {
        data.is_done = false;
      }

      // If creating as done, validate constraints
      if (data.is_done) {
        // Check backlog presence
        const backlogCount = await trx('categories')
          .where({ board_id: data.board_id, is_done: false })
          .count<{ count: string }>('id as count')
          .first();

        if (!backlogCount || Number(backlogCount.count) === 0) {
          throw new Error('Each board must have at least one backlog category (is_done = false)');
        }

        // Check max 9 done categories
        const doneCount = await trx('categories')
          .where({ board_id: data.board_id, is_done: true })
          .count<{ count: string }>('id as count')
          .first();

        if (doneCount && Number(doneCount.count) >= 9) {
          throw new Error('A board can have at most 9 done categories');
        }
      }

      // Get an available color
      const color = await getAvailableColor('categories', data.board_id, data.color);

      // Get position count for fallback
      const positionCount = await trx('categories')
        .where({ board_id: data.board_id })
        .count<{ count: string }>('id as count')
        .first();

      const finalPosition = data.position ?? parseInt(positionCount?.count as string, 10);

      // Insert new category
      const [category] = await trx('categories')
        .insert({
          board_id: data.board_id,
          name: data.name,
          color,
          position: finalPosition,
          is_done: data.is_done ?? false,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      return category;
    });
  };

  static updateCategory = async (data: UpdateCategory): Promise<CategoryBaseData> => {
    const { id, board_id, position, is_done, ...rest } = data;

    return await knex.transaction(async (trx) => {
      // --- Reorder positions if needed ---
      if (position !== undefined) {
        const otherCategories = await trx('categories')
          .where({ board_id })
          .andWhereNot({ id })
          .orderBy('position', 'asc');

        const newPositions: Record<number, number> = {};
        let currentPos = 1;

        for (const cat of otherCategories) {
          if (currentPos === position) currentPos++;
          newPositions[cat.id] = currentPos;
          currentPos++;
        }

        for (const [catId, newPos] of Object.entries(newPositions)) {
          await trx('categories')
            .where({ id: Number(catId) })
            .update({ position: newPos });
        }
      }

      // --- Validate is_done constraints ---
      if (is_done !== undefined) {
        if (is_done === true) {
          // Rule 1: Must leave at least 1 backlog category
          const backlogCount = await trx('categories')
            .where({ board_id })
            .andWhereNot({ id })
            .andWhere({ is_done: false })
            .count<{ count: string }>('id as count')
            .first();

          if (!backlogCount || Number(backlogCount.count) === 0) {
            throw new Error('Each board must have at least one backlog category (is_done = false)');
          }

          // Rule 2: Max 9 done categories allowed
          const doneCount = await trx('categories')
            .where({ board_id, is_done: true })
            .andWhereNot({ id }) // exclude current since it might already be done
            .count<{ count: string }>('id as count')
            .first();

          if (doneCount && Number(doneCount.count) >= 9) {
            throw new Error('A board can have at most 9 done categories');
          }
        }
      }

      // --- Perform the update ---
      const [updatedCategory] = await trx('categories')
        .where({ id, board_id })
        .update({
          ...rest,
          ...(position !== undefined ? { position } : {}),
          ...(is_done !== undefined ? { is_done } : {}),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      return updatedCategory;
    });
  };

  static deleteCategory = async (data: DeleteCategory): Promise<number> => {
    return await knex.transaction(async (trx) => {
      // Find category inside transaction
      const category = await trx('categories')
        .where({ id: data.id, board_id: data.board_id })
        .first();

      if (!category) throw new Error('Category not found');

      // Check if category has todos
      const todoCount = await trx('todos')
        .where({ category_id: data.id })
        .count<{ count: string }>('id as count')
        .first();

      if (todoCount && Number(todoCount.count) > 0) {
        throw new Error('Cannot delete a category that still has todos');
      }

      // Count categories in board
      const count = await trx('categories')
        .where({ board_id: category.board_id })
        .count<{ count: string }>('id as count')
        .first();

      if (Number(count?.count ?? 0) <= 2) {
        throw new Error('A board must have at least two categories');
      }

      // Delete category
      const deleted = await trx('categories')
        .where({ id: data.id, board_id: data.board_id })
        .del();

      // Rebalance positions (optional but keeps them sequential)
      const remaining = await trx('categories')
        .where({ board_id: category.board_id })
        .orderBy('position', 'asc');

      let pos = 0;
      for (const cat of remaining) {
        await trx('categories')
          .where({ id: cat.id })
          .update({ position: pos++ });
      }

      return deleted;
    });
  };

  static listAllCategoriesInBoard = async (data: ListCategoriesForBoard): Promise<CategoryBaseData[]> => {
        return await knex('categories')
        .where({ board_id : data.board_id })
        .orderBy('position','asc')//orders descending by numerical vallue of position
        .select('*');
  };

// -- BULK OPERATIONS -- //
static reorderCategories = async (board_id: number, newOrder: number[]): Promise<void> => {
  await knex.transaction(async (trx) => {
    if (!newOrder.length) return;

    // Build a CASE statement mapping each category ID => new position index
    const caseStatements = newOrder
      .map((id, index) => `WHEN ${id} THEN ${index}`)
      .join(' ');

    // Create a comma-separated list of IDs for the WHERE clause
    const ids = newOrder.join(',');

    // Step 1: temporarily move all positions out of the way to avoid unique constraint conflicts
    await trx.raw(
      `
      UPDATE categories
      SET position = position + 1000
      WHERE board_id = ? AND id IN (${ids})
    `,
      [board_id]
    );

    // Step 2: assign the final positions
    await trx.raw(
      `
      UPDATE categories
      SET position = CASE id
        ${caseStatements}
      END
      WHERE board_id = ? AND id IN (${ids})
    `,
      [board_id]
    );
  });
};

}

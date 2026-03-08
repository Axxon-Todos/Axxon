import { beforeEach, describe, expect, it } from 'vitest';

import { Categories } from '@/lib/models/categories';

import { db, resetDatabase } from '../db';
import {
  createBoardRecord,
  createCategoryRecord,
  createTodoRecord,
  createUser,
} from '../factories';

describe('Categories model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('rejects creating more than ten categories for a board', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });

    for (let index = 0; index < 10; index += 1) {
      await createCategoryRecord({
        boardId: board.id,
        position: index,
        name: `Category ${index + 1}`,
        isDone: index === 9,
      });
    }

    await expect(
      Categories.createCategory({
        board_id: board.id,
        name: 'Overflow',
        color: '#ef4444',
        position: 10,
        is_done: false,
      })
    ).rejects.toThrow('Maximum categories reached');
  });

  it('reorders positions when a category moves', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });
    const first = await createCategoryRecord({ boardId: board.id, position: 1, name: 'First' });
    const second = await createCategoryRecord({ boardId: board.id, position: 2, name: 'Second' });
    const third = await createCategoryRecord({ boardId: board.id, position: 3, name: 'Third' });

    const updated = await Categories.updateCategory({
      id: third.id,
      board_id: board.id,
      position: 1,
    });

    const categories = await db('categories')
      .where({ board_id: board.id })
      .orderBy('position', 'asc');

    expect(updated.position).toBe(1);
    expect(categories.map((category) => [category.name, category.position])).toEqual([
      ['Third', 1],
      ['First', 2],
      ['Second', 3],
    ]);
  });

  it('blocks marking a category active while it has completed todos', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });
    const doneCategory = await createCategoryRecord({
      boardId: board.id,
      position: 0,
      isDone: true,
      name: 'Done',
    });

    await createTodoRecord({
      boardId: board.id,
      categoryId: doneCategory.id,
      isComplete: true,
    });

    await expect(
      Categories.updateCategory({
        id: doneCategory.id,
        board_id: board.id,
        is_done: false,
      })
    ).rejects.toThrow('Cannot mark category as active while it contains completed todos');
  });

  it('blocks deleting categories that still contain todos', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });
    const category = await createCategoryRecord({ boardId: board.id, position: 0 });

    await createTodoRecord({
      boardId: board.id,
      categoryId: category.id,
    });

    await expect(
      Categories.deleteCategory({ id: category.id, board_id: board.id })
    ).rejects.toThrow('Cannot delete a category that still has todos');
  });

  it('rebalances positions after deleting a category', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });
    await createCategoryRecord({ boardId: board.id, position: 0, name: 'Backlog' });
    const middle = await createCategoryRecord({ boardId: board.id, position: 1, name: 'Doing' });
    await createCategoryRecord({ boardId: board.id, position: 2, name: 'Done', isDone: true });

    const deleted = await Categories.deleteCategory({ id: middle.id, board_id: board.id });
    const remaining = await db('categories')
      .where({ board_id: board.id })
      .orderBy('position', 'asc');

    expect(deleted).toBe(1);
    expect(remaining.map((category) => category.position)).toEqual([0, 1]);
  });
});

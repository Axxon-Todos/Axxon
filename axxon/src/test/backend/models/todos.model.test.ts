import { beforeEach, describe, expect, it } from 'vitest';

import { Todos } from '@/lib/models/todos';

import { resetDatabase } from '../db';
import {
  createBoardRecord,
  createCategoryRecord,
  createUser,
} from '../factories';

describe('Todos model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('uses the first category when a category is not provided', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });
    const firstCategory = await createCategoryRecord({
      boardId: board.id,
      position: 0,
      name: 'Backlog',
    });
    await createCategoryRecord({
      boardId: board.id,
      position: 1,
      name: 'Done',
      isDone: true,
    });

    const todo = await Todos.createTodo({
      board_id: board.id,
      title: 'Investigate flaky test',
    });

    expect(todo.category_id).toBe(firstCategory.id);
  });

  it('rejects completed todos outside done categories', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });
    const backlog = await createCategoryRecord({
      boardId: board.id,
      position: 0,
      isDone: false,
    });

    await expect(
      Todos.createTodo({
        board_id: board.id,
        title: 'Invalid complete todo',
        category_id: backlog.id,
        is_complete: true,
      })
    ).rejects.toThrow('Completed todos must belong to a done category');
  });

  it('rejects updates that move a completed todo into an active category', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });
    const activeCategory = await createCategoryRecord({
      boardId: board.id,
      position: 0,
      isDone: false,
      name: 'Backlog',
    });
    const doneCategory = await createCategoryRecord({
      boardId: board.id,
      position: 1,
      isDone: true,
      name: 'Done',
    });

    const todo = await Todos.createTodo({
      board_id: board.id,
      title: 'Release patch',
      category_id: doneCategory.id,
      is_complete: true,
    });

    await expect(
      Todos.updateTodo({
        id: todo.id,
        board_id: board.id,
        category_id: activeCategory.id,
      })
    ).rejects.toThrow('Completed todos must belong to a done category');
  });
});

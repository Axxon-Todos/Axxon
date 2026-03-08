import { beforeEach, describe, expect, it } from 'vitest';

import { TodoLabels } from '@/lib/models/todoLabels';

import { resetDatabase } from '../db';
import {
  addTodoLabel,
  addBoardMember,
  createBoardRecord,
  createCategoryRecord,
  createLabelRecord,
  createTodoRecord,
  createUser,
} from '../factories';

describe('TodoLabels model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('hydrates labels for a single todo', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });
    const category = await createCategoryRecord({ boardId: board.id, position: 0 });
    const todo = await createTodoRecord({ boardId: board.id, categoryId: category.id });
    const backend = await createLabelRecord({ boardId: board.id, name: 'Backend' });
    const urgent = await createLabelRecord({ boardId: board.id, name: 'Urgent' });

    await addTodoLabel(todo.id, backend.id);
    await addTodoLabel(todo.id, urgent.id);

    const hydrated = await TodoLabels.getTodoByIdWithLabels(todo.id, board.id);

    expect(hydrated?.labels.map((label) => label.name).sort()).toEqual(['Backend', 'Urgent']);
  });

  it('hydrates labels across a board of todos', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });
    const category = await createCategoryRecord({ boardId: board.id, position: 0 });
    const firstTodo = await createTodoRecord({
      boardId: board.id,
      categoryId: category.id,
      title: 'First todo',
    });
    const secondTodo = await createTodoRecord({
      boardId: board.id,
      categoryId: category.id,
      title: 'Second todo',
    });
    const backend = await createLabelRecord({ boardId: board.id, name: 'Backend' });
    const design = await createLabelRecord({ boardId: board.id, name: 'Design' });

    await addTodoLabel(firstTodo.id, backend.id);
    await addTodoLabel(secondTodo.id, design.id);

    const hydratedTodos = await TodoLabels.getTodosWithLabels(board.id);

    expect(hydratedTodos).toHaveLength(2);
    expect(hydratedTodos.find((todo) => todo.id === firstTodo.id)?.labels[0]?.name).toBe('Backend');
    expect(hydratedTodos.find((todo) => todo.id === secondTodo.id)?.labels[0]?.name).toBe('Design');
  });

  it('hydrates assignee names for board todos', async () => {
    const creator = await createUser();
    const assignee = await createUser({ first_name: 'Ada', last_name: 'Lovelace' });
    const board = await createBoardRecord({ createdBy: creator.id });
    await addBoardMember(board.id, assignee.id);
    const category = await createCategoryRecord({ boardId: board.id, position: 0 });
    const todo = await createTodoRecord({
      boardId: board.id,
      categoryId: category.id,
      assigneeId: assignee.id,
      title: 'Assigned todo',
    });

    const hydratedTodos = await TodoLabels.getTodosWithLabels(board.id);

    expect(hydratedTodos.find((item) => item.id === todo.id)?.assignee).toMatchObject({
      id: assignee.id,
      name: 'Ada Lovelace',
    });
  });
});

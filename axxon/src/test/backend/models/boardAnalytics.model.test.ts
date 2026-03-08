import { beforeEach, describe, expect, it } from 'vitest';

import { BoardAnalytics } from '@/lib/models/boardAnalytics';

import { resetDatabase } from '../db';
import {
  addBoardMember,
  addTodoLabel,
  createBoardRecord,
  createCategoryRecord,
  createLabelRecord,
  createTodoRecord,
  createUser,
} from '../factories';

describe('BoardAnalytics model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('aggregates summary, category, member, and label metrics', async () => {
    const creator = await createUser({ first_name: 'Ada', last_name: 'Lovelace' });
    const collaborator = await createUser({ first_name: 'Grace', last_name: 'Hopper' });
    const board = await createBoardRecord({ createdBy: creator.id, color: '#334155' });

    await addBoardMember(board.id, creator.id);
    await addBoardMember(board.id, collaborator.id);

    const backlog = await createCategoryRecord({
      boardId: board.id,
      name: 'Backlog',
      position: 0,
      isDone: false,
    });
    const done = await createCategoryRecord({
      boardId: board.id,
      name: 'Done',
      position: 1,
      isDone: true,
    });
    const backend = await createLabelRecord({ boardId: board.id, name: 'Backend' });

    const activeTodo = await createTodoRecord({
      boardId: board.id,
      categoryId: backlog.id,
      assigneeId: creator.id,
      isComplete: false,
    });
    const completedTodo = await createTodoRecord({
      boardId: board.id,
      categoryId: done.id,
      assigneeId: collaborator.id,
      isComplete: true,
    });

    await addTodoLabel(activeTodo.id, backend.id);
    await addTodoLabel(completedTodo.id, backend.id);

    const analytics = await BoardAnalytics.getBoardAnalytics(board.id);

    expect(analytics.board.color).toBe('#334155');
    expect(analytics.summary.total_todos).toBe(2);
    expect(analytics.summary.completed_todos).toBe(1);
    expect(analytics.summary.active_todos).toBe(1);
    expect(analytics.summary.completion_rate).toBe(50);
    expect(analytics.categories.map((category) => category.name)).toEqual(['Backlog', 'Done']);
    expect(analytics.members[0]?.assigned_completed_todos).toBeGreaterThanOrEqual(
      analytics.members[1]?.assigned_completed_todos ?? 0
    );
    expect(analytics.labels[0]?.name).toBe('Backend');
    expect(analytics.labels[0]?.total_todos).toBe(2);
  });
});

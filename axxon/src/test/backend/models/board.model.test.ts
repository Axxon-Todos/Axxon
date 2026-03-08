import { beforeEach, describe, expect, it } from 'vitest';

import { Board } from '@/lib/models/board';

import { db, resetDatabase } from '../db';
import { createUser } from '../factories';

describe('Board model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates a board with color, default categories, and invited members', async () => {
    const creator = await createUser({ email: 'creator@example.com' });
    const invitee = await createUser({ email: 'invitee@example.com' });

    const board = await Board.createBoard({
      name: 'Product Roadmap',
      created_by: creator.id,
      color: '#123456',
      member_emails: [invitee.email, 'missing@example.com'],
    });

    expect(board.color).toBe('#123456');

    const categories = await db('categories')
      .where({ board_id: board.id })
      .orderBy('position', 'asc');
    const members = await db('board_members')
      .where({ board_id: board.id })
      .orderBy('user_id', 'asc');

    expect(categories.map((category) => category.name)).toEqual([
      'Backlog',
      'Todo',
      'In Progress',
      'Done',
      'Cancelled',
    ]);
    expect(categories.find((category) => category.name === 'Done')?.is_done).toBe(true);
    expect(members.map((member) => member.user_id)).toEqual([creator.id, invitee.id]);
  });

  it('deletes a board and cascades related rows', async () => {
    const creator = await createUser();
    const board = await Board.createBoard({
      name: 'Cleanup Test',
      created_by: creator.id,
      color: '#0f172a',
      member_emails: [],
    });

    const deleted = await Board.deleteBoard({ id: String(board.id) });

    const boardCount = await db('boards').where({ id: board.id }).count<{ count: string }>('id as count').first();
    const categoryCount = await db('categories')
      .where({ board_id: board.id })
      .count<{ count: string }>('id as count')
      .first();
    const membershipCount = await db('board_members')
      .where({ board_id: board.id })
      .count<{ count: string }>('user_id as count')
      .first();

    expect(deleted).toBe(1);
    expect(Number(boardCount?.count ?? 0)).toBe(0);
    expect(Number(categoryCount?.count ?? 0)).toBe(0);
    expect(Number(membershipCount?.count ?? 0)).toBe(0);
  });
});

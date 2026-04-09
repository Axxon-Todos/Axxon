// Verifies the development seed stays compatible with the org-first schema and bootstrap flow.
import { beforeEach, describe, expect, it } from 'vitest';

import { rollbackSeed, seed } from '@/lib/db/seeds/01_full_seed';

import { db, resetDatabase } from '../db';

async function countRows(tableName: string) {
  const result = await db(tableName).count<{ count: string }>('* as count').first();
  return Number(result?.count ?? 0);
}

describe('full development seed', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates org-scoped boards with valid organization memberships', async () => {
    await seed(db);

    const xavier = await db('users')
      .where({ email: 'xaviercampos2425@gmail.com' })
      .first<{ id: number }>();

    if (!xavier) {
      throw new Error('Expected Xavier to exist after running the development seed.');
    }

    const xavierBoardCount = await db('boards')
      .where({ created_by: xavier.id })
      .count<{ count: string }>('id as count')
      .first();

    const boardsMissingOrganization = await db('boards')
      .whereNull('organization_id')
      .count<{ count: string }>('id as count')
      .first();

    const invalidBoardMemberships = await db('board_members')
      .join('boards', 'boards.id', 'board_members.board_id')
      .leftJoin('organization_members', function joinOrganizationMembers() {
        this.on('organization_members.organization_id', '=', 'boards.organization_id').andOn(
          'organization_members.user_id',
          '=',
          'board_members.user_id'
        );
      })
      .whereNull('organization_members.user_id')
      .count<{ count: string }>('board_members.board_id as count')
      .first();

    expect(await countRows('users')).toBe(4);
    expect(await countRows('organizations')).toBe(2);
    expect(await countRows('organization_members')).toBe(8);
    expect(await countRows('boards')).toBe(100);
    expect(Number(xavierBoardCount?.count ?? 0)).toBeGreaterThanOrEqual(30);
    expect(Number(boardsMissingOrganization?.count ?? 0)).toBe(0);
    expect(Number(invalidBoardMemberships?.count ?? 0)).toBe(0);
  });

  it('rolls back seeded workspace data cleanly', async () => {
    await seed(db);
    await rollbackSeed(db);

    expect(await countRows('users')).toBe(0);
    expect(await countRows('organizations')).toBe(0);
    expect(await countRows('boards')).toBe(0);
    expect(await countRows('todos')).toBe(0);
  });
});

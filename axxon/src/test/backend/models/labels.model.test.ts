import { beforeEach, describe, expect, it } from 'vitest';

import { Labels } from '@/lib/models/labels';

import { resetDatabase } from '../db';
import { createBoardRecord, createUser } from '../factories';

describe('Labels model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('trims label names before saving', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });

    const label = await Labels.createLabel({
      board_id: board.id,
      name: '  Priority  ',
      color: '#ef4444',
    });

    expect(label.name).toBe('Priority');
  });

  it('rejects duplicate names within the same board', async () => {
    const creator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });

    await Labels.createLabel({
      board_id: board.id,
      name: 'Backend',
      color: '#2563eb',
    });

    await expect(
      Labels.createLabel({
        board_id: board.id,
        name: 'Backend',
        color: '#10b981',
      })
    ).rejects.toThrow('A label with this name already exists for this board.');
  });
});

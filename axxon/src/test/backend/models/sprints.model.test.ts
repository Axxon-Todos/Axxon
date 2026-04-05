import { beforeEach, describe, expect, it } from 'vitest';

import { Sprints } from '@/lib/models/sprints';

import { db, resetDatabase } from '../db';
import { createBoardRecord, createUser } from '../factories';

describe('Sprints model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates a sprint with normalized values', async () => {
    const creator = await createUser({ email: 'creator@example.com' });
    const board = await createBoardRecord({ createdBy: creator.id });

    const sprint = await Sprints.createSprint({
      board_id: board.id,
      name: '  Platform Sprint  ',
      description: '  Harden the delivery flow.  ',
      start_date: '2030-01-01',
      end_date: '2030-01-14',
      color: null,
      icon: 'flag',
    });

    const persistedSprint = await db('sprints').where({ id: sprint.id }).first();

    expect(sprint.name).toBe('Platform Sprint');
    expect(sprint.description).toBe('Harden the delivery flow.');
    expect(persistedSprint?.name).toBe('Platform Sprint');
  });

  it('rejects end dates that come before the start date', async () => {
    const creator = await createUser({ email: 'creator@example.com' });
    const board = await createBoardRecord({ createdBy: creator.id });

    await expect(
      Sprints.createSprint({
        board_id: board.id,
        name: 'Invalid Sprint',
        description: null,
        start_date: '2030-01-14',
        end_date: '2030-01-01',
        color: null,
        icon: 'target',
      })
    ).rejects.toThrow('Sprint end date must be on or after the start date');
  });

  it('updates and archives an existing sprint', async () => {
    const creator = await createUser({ email: 'creator@example.com' });
    const board = await createBoardRecord({ createdBy: creator.id });
    const sprint = await Sprints.createSprint({
      board_id: board.id,
      name: 'Launch Sprint',
      description: null,
      start_date: '2030-02-01',
      end_date: '2030-02-14',
      color: '#2563eb',
      icon: 'rocket',
    });

    const updatedSprint = await Sprints.updateSprint({
      id: sprint.id,
      board_id: board.id,
      name: 'Launch Sprint Updated',
      archived_at: '2030-02-15T12:00:00.000Z',
    });

    expect(updatedSprint?.name).toBe('Launch Sprint Updated');
    expect(updatedSprint?.archived_at).toBeTruthy();
  });
});

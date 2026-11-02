// Verifies architecture migration rollback behavior does not silently destroy durable history.
import type { Knex } from 'knex';
import { describe, expect, it } from 'vitest';
import * as migration031 from '@/lib/db/migrations/031_expand_architecture_catalog';
import * as migration032 from '@/lib/db/migrations/032_create_architecture_collaboration';
import * as migration033 from '@/lib/db/migrations/033_create_architecture_requirements_and_change_sets';
import * as migration034 from '@/lib/db/migrations/034_allow_architecture_change_set_iterations';

describe('architecture migration rollback integrity', () => {
  it.each([
    ['031', migration031.down, 'vocabulary'],
    ['032', migration032.down, 'collaboration history'],
    ['033', migration033.down, 'review history'],
  ])('marks migration %s irreversible with a useful error', async (_name, down, reason) => {
    await expect(down({} as Knex)).rejects.toThrow(reason);
  });

  it('rejects migration 034 rollback when iterations would violate the old unique run constraint', async () => {
    const query = {
      select: () => query,
      count: () => query,
      groupBy: () => query,
      having: async () => [{ run_id: 7, count: '2' }],
    };
    await expect(migration034.down((() => query) as unknown as Knex)).rejects.toThrow('duplicate run_id');
  });
});

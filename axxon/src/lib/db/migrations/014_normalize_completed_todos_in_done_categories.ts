import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const nonDoneCategoryIds = knex('categories').select('id').where({ is_done: false });

  await knex('todos')
    .where({ is_complete: true })
    .whereIn('category_id', nonDoneCategoryIds)
    .update({
      is_complete: false,
      updated_at: knex.fn.now(),
    });
}

export async function down(): Promise<void> {}

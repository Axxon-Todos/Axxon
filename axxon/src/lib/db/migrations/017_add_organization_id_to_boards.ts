import type { Knex } from 'knex';

type ExistingBoardRecord = {
  id: number;
  created_by: number;
};

type ExistingOrganizationRecord = {
  id: number;
  created_by: number;
};

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (table) => {
    table
      .integer('organization_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
  });

  const existingBoards = (await knex('boards')
    .select('id', 'created_by')
    .orderBy('id', 'asc')) as ExistingBoardRecord[];

  if (existingBoards.length > 0) {
    const distinctCreators = Array.from(
      new Set(existingBoards.map((board) => board.created_by))
    );

    for (const creatorId of distinctCreators) {
      const [organization] = (await knex('organizations')
        .insert({
          name: `Org ${creatorId}`,
          description: 'Auto-created during organization migration.',
          color: '#2563eb',
          created_by: creatorId,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        })
        .returning(['id', 'created_by'])) as ExistingOrganizationRecord[];

      await knex('organization_members')
        .insert({
          organization_id: organization.id,
          user_id: creatorId,
          role: 'owner',
          created_at: knex.fn.now(),
        })
        .onConflict(['organization_id', 'user_id'])
        .ignore();

      await knex('boards')
        .where({ created_by: creatorId })
        .update({ organization_id: organization.id });
    }
  }

  await knex.schema.alterTable('boards', (table) => {
    table.integer('organization_id').unsigned().notNullable().alter();
    table.index(['organization_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (table) => {
    table.dropIndex(['organization_id']);
    table.dropColumn('organization_id');
  });
}

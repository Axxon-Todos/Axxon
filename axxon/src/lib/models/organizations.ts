import knex from '@/lib/db/db';
import type {
  OrganizationBaseData,
  OrganizationCreation,
  OrganizationSummary,
} from '@/lib/types/organizationTypes';

type RawOrganizationSummary = OrganizationBaseData & {
  member_count: string | number;
  accessible_board_count: string | number;
  repo_count: string | number;
};

function normalizeOrganizationSummary(
  organization: RawOrganizationSummary
): OrganizationSummary {
  return {
    ...organization,
    member_count: Number(organization.member_count ?? 0),
    accessible_board_count: Number(organization.accessible_board_count ?? 0),
    repo_count: Number(organization.repo_count ?? 0),
  };
}

export class Organizations {
  static async createOrganization(
    data: OrganizationCreation
  ): Promise<OrganizationBaseData> {
    return knex.transaction(async (trx) => {
      const [organization] = await trx('organizations')
        .insert({
          name: data.name,
          description: data.description ?? null,
          color: data.color ?? null,
          created_by: data.created_by,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        })
        .returning('*');

      await trx('organization_members').insert({
        organization_id: organization.id,
        user_id: data.created_by,
        role: 'owner',
        created_at: knex.fn.now(),
      });

      return organization;
    });
  }

  static async listForUser(userId: number): Promise<OrganizationSummary[]> {
    const organizations = await knex('organizations')
      .join('organization_members as organization_scope', function joinScope() {
        this.on('organizations.id', '=', 'organization_scope.organization_id').andOnVal(
          'organization_scope.user_id',
          userId
        );
      })
      .select(
        'organizations.*',
        knex('organization_members')
          .countDistinct('user_id')
          .whereRaw('organization_members.organization_id = organizations.id')
          .as('member_count'),
        knex('boards')
          .join('board_members', 'boards.id', 'board_members.board_id')
          .countDistinct('boards.id')
          .whereRaw('boards.organization_id = organizations.id')
          .andWhere('board_members.user_id', userId)
          .as('accessible_board_count'),
        knex.raw('0::integer as repo_count')
      )
      .orderBy('organizations.created_at', 'desc');

    return organizations.map((organization) =>
      normalizeOrganizationSummary(organization as RawOrganizationSummary)
    );
  }

  static async getById(id: number): Promise<OrganizationBaseData | null> {
    return (await knex('organizations').where({ id }).first()) ?? null;
  }

  static async getSummaryById(
    organizationId: number,
    userId: number
  ): Promise<OrganizationSummary | null> {
    const organization = await knex('organizations')
      .where('organizations.id', organizationId)
      .select(
        'organizations.*',
        knex('organization_members')
          .countDistinct('user_id')
          .whereRaw('organization_members.organization_id = organizations.id')
          .as('member_count'),
        knex('boards')
          .join('board_members', 'boards.id', 'board_members.board_id')
          .countDistinct('boards.id')
          .whereRaw('boards.organization_id = organizations.id')
          .andWhere('board_members.user_id', userId)
          .as('accessible_board_count'),
        knex.raw('0::integer as repo_count')
      )
      .first();

    if (!organization) {
      return null;
    }

    return normalizeOrganizationSummary(organization as RawOrganizationSummary);
  }
}

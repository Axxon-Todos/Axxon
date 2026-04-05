import knex from '@/lib/db/db';
import type {
  OrganizationMemberBaseData,
  OrganizationMemberRecord,
  OrganizationMemberRole,
} from '@/lib/types/organizationMemberTypes';
import type { User } from '@/lib/types/users';

function applyUserSearch(
  queryBuilder: ReturnType<typeof knex>,
  query: string
) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return queryBuilder;
  }

  const searchPattern = `%${trimmedQuery}%`;

  return queryBuilder.andWhere((builder) => {
    builder
      .where('users.email', 'ilike', searchPattern)
      .orWhere('users.first_name', 'ilike', searchPattern)
      .orWhere('users.last_name', 'ilike', searchPattern)
      .orWhereRaw(
        `concat_ws(' ', users.first_name, users.last_name) ilike ?`,
        [searchPattern]
      );
  });
}

export class OrganizationMembers {
  static async isMember(organizationId: number, userId: number): Promise<boolean> {
    const membership = await knex('organization_members')
      .where({
        organization_id: organizationId,
        user_id: userId,
      })
      .first();

    return Boolean(membership);
  }

  static async getRole(
    organizationId: number,
    userId: number
  ): Promise<OrganizationMemberRole | null> {
    const membership = await knex('organization_members')
      .where({
        organization_id: organizationId,
        user_id: userId,
      })
      .first('role');

    return membership?.role ?? null;
  }

  static async listMembersForOrganization(
    organizationId: number
  ): Promise<OrganizationMemberRecord[]> {
    return knex('users')
      .join('organization_members', 'users.id', 'organization_members.user_id')
      .where('organization_members.organization_id', organizationId)
      .select(
        'users.*',
        'organization_members.organization_id',
        'organization_members.role'
      )
      .orderBy('organization_members.role', 'asc')
      .orderBy('users.first_name', 'asc');
  }

  static async listMembershipsForUserIds(
    organizationId: number,
    userIds: number[]
  ): Promise<OrganizationMemberBaseData[]> {
    if (userIds.length === 0) {
      return [];
    }

    return knex('organization_members')
      .where('organization_id', organizationId)
      .whereIn('user_id', userIds)
      .select('*');
  }

  static async listInviteCandidates(
    organizationId: number,
    query: string
  ): Promise<User[]> {
    if (query.trim().length < 2) {
      return [];
    }

    const queryBuilder = knex('users')
      .whereNotExists(function excludeCurrentOrgMembers() {
        this.select(knex.raw('1'))
          .from('organization_members')
          .whereRaw('organization_members.user_id = users.id')
          .andWhere('organization_members.organization_id', organizationId);
      })
      .select('users.*')
      .orderBy('users.first_name', 'asc')
      .orderBy('users.last_name', 'asc')
      .orderBy('users.email', 'asc');

    return applyUserSearch(queryBuilder, query);
  }

  static async addMembers(
    organizationId: number,
    userIds: number[],
    role: OrganizationMemberRole = 'member'
  ): Promise<number> {
    if (userIds.length === 0) {
      return 0;
    }

    return knex.transaction(async (trx) => {
      const existingMemberships = await trx('organization_members')
        .where('organization_id', organizationId)
        .whereIn('user_id', userIds)
        .select('user_id');

      const existingUserIds = new Set(
        existingMemberships.map((membership) => membership.user_id)
      );
      const newUserIds = userIds.filter((userId) => !existingUserIds.has(userId));

      if (newUserIds.length === 0) {
        return 0;
      }

      await trx('organization_members').insert(
        newUserIds.map((userId) => ({
          organization_id: organizationId,
          user_id: userId,
          role,
          created_at: knex.fn.now(),
        }))
      );

      return newUserIds.length;
    });
  }
}

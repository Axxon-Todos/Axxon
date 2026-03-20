import knex from '@/lib/db/db';
import type {
  OrganizationMemberRecord,
  OrganizationMemberRole,
} from '@/lib/types/organizationMemberTypes';

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
}

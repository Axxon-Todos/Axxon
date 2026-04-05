import type { User } from '@/lib/types/users';

export type OrganizationMemberRole = 'owner' | 'member';

export type OrganizationMemberBaseData = {
  organization_id: number;
  user_id: number;
  role: OrganizationMemberRole;
  created_at: string;
};

export type OrganizationMemberRecord = User & {
  organization_id: number;
  role: OrganizationMemberRole;
};

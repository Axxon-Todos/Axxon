import { beforeEach, describe, expect, it } from 'vitest';

import { OrganizationMembers } from '@/lib/models/organizationMembers';

import { resetDatabase } from '../db';
import {
  addOrganizationMember,
  createOrganizationRecord,
  createUser,
} from '../factories';

describe('OrganizationMembers model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns matching users who are not already in the organization', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const matchingUser = await createUser({
      email: 'alex@example.com',
      first_name: 'Alex',
      last_name: 'Morgan',
    });
    const existingMember = await createUser({
      email: 'alex-member@example.com',
      first_name: 'Alexis',
      last_name: 'Member',
    });
    const organization = await createOrganizationRecord({ createdBy: owner.id });

    await addOrganizationMember(organization.id, existingMember.id);

    const candidates = await OrganizationMembers.listInviteCandidates(
      organization.id,
      'alex'
    );

    expect(candidates.map((candidate) => candidate.id)).toEqual([matchingUser.id]);
  });
});

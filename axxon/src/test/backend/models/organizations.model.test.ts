// Verifies org summaries expose repo counts and the current member role for sidebar and workspace navigation.
import { beforeEach, describe, expect, it } from 'vitest';

import { Organizations } from '@/lib/models/organizations';

import { resetDatabase } from '../db';
import {
  createGitHubInstallationRecord,
  createOrganizationRecord,
  createRepositoryRecord,
  createUser,
} from '../factories';

describe('Organizations model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('includes active repository counts and the current user role in organization summaries', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const installation = await createGitHubInstallationRecord({
      organizationId: organization.id,
      installedByUserId: owner.id,
    });

    await createRepositoryRecord({
      organizationId: organization.id,
      githubInstallationId: installation.github_installation_id,
      name: 'active-one',
    });
    await createRepositoryRecord({
      organizationId: organization.id,
      githubInstallationId: installation.github_installation_id,
      name: 'active-two',
    });
    await createRepositoryRecord({
      organizationId: organization.id,
      githubInstallationId: installation.github_installation_id,
      name: 'inactive-repo',
      isActive: false,
    });

    const summary = await Organizations.getSummaryById(organization.id, owner.id);

    expect(summary?.repo_count).toBe(2);
    expect(summary?.current_user_role).toBe('owner');
  });
});

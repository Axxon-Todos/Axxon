import { beforeEach, describe, expect, it } from 'vitest';

import { BoardRepositoryAccess } from '@/lib/models/boardRepositoryAccess';

import { resetDatabase } from '../db';
import {
  createBoardRecord,
  createBoardRepositoryAccessRecord,
  createGitHubInstallationRecord,
  createOrganizationRecord,
  createRepositoryRecord,
  createUser,
} from '../factories';

describe('BoardRepositoryAccess model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('lists repositories linked to a board', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({ createdBy: owner.id });
    const installation = await createGitHubInstallationRecord({
      organizationId: organization.id,
      installedByUserId: owner.id,
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
    });
    const repository = await createRepositoryRecord({
      organizationId: organization.id,
      githubInstallationId: installation.github_installation_id,
      name: 'platform',
    });

    await createBoardRepositoryAccessRecord({
      boardId: board.id,
      repositoryId: repository.id,
    });

    const repositories = await BoardRepositoryAccess.listRepositoriesForBoard(board.id);

    expect(repositories).toHaveLength(1);
    expect(repositories[0]?.id).toBe(repository.id);
  });

  it('replaces repository links for a board', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({ createdBy: owner.id });
    const installation = await createGitHubInstallationRecord({
      organizationId: organization.id,
      installedByUserId: owner.id,
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
    });
    const repositoryOne = await createRepositoryRecord({
      organizationId: organization.id,
      githubInstallationId: installation.github_installation_id,
      name: 'platform',
    });
    const repositoryTwo = await createRepositoryRecord({
      organizationId: organization.id,
      githubInstallationId: installation.github_installation_id,
      name: 'api',
    });

    await createBoardRepositoryAccessRecord({
      boardId: board.id,
      repositoryId: repositoryOne.id,
    });

    await BoardRepositoryAccess.replaceRepositoriesForBoard({
      boardId: board.id,
      repositoryIds: [repositoryTwo.id],
    });

    const repositories = await BoardRepositoryAccess.listRepositoriesForBoard(board.id);

    expect(repositories.map((repository) => repository.id)).toEqual([repositoryTwo.id]);
  });
});

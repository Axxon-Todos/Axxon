// Persists org-owned repository records mirrored from GitHub installations.
import db from '@/lib/db/db';
import type { RepositoryRecord } from '@/lib/types/githubIntegrationTypes';

type RepositoryUpsertInput = Omit<RepositoryRecord, 'id' | 'created_at' | 'updated_at'>;

export class Repositories {
  static async listForOrganization(
    organizationId: number
  ): Promise<RepositoryRecord[]> {
    return db('repositories')
      .where({
        organization_id: organizationId,
        is_active: true,
      })
      .orderBy('full_name', 'asc');
  }

  static async upsertRepositories(repositories: RepositoryUpsertInput[]) {
    if (repositories.length === 0) {
      return;
    }

    await db('repositories')
      .insert(
        repositories.map((repository) => ({
          ...repository,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        }))
      )
      .onConflict(['github_repo_id'])
      .merge({
        organization_id: db.ref('excluded.organization_id'),
        github_installation_id: db.ref('excluded.github_installation_id'),
        name: db.ref('excluded.name'),
        full_name: db.ref('excluded.full_name'),
        owner_login: db.ref('excluded.owner_login'),
        default_branch: db.ref('excluded.default_branch'),
        private: db.ref('excluded.private'),
        archived: db.ref('excluded.archived'),
        html_url: db.ref('excluded.html_url'),
        is_active: db.ref('excluded.is_active'),
        raw_json: db.ref('excluded.raw_json'),
        updated_at: db.fn.now(),
      });
  }

  static async deactivateMissingForInstallation({
    organizationId,
    githubInstallationId,
    activeGithubRepoIds,
  }: {
    organizationId: number;
    githubInstallationId: string;
    activeGithubRepoIds: string[];
  }): Promise<number> {
    const query = db('repositories')
      .where({
        organization_id: organizationId,
        github_installation_id: githubInstallationId,
        is_active: true,
      });

    if (activeGithubRepoIds.length > 0) {
      query.whereNotIn('github_repo_id', activeGithubRepoIds);
    }

    return query.update({
      is_active: false,
      updated_at: db.fn.now(),
    });
  }

  static async deactivateAllForInstallation({
    organizationId,
    githubInstallationId,
  }: {
    organizationId: number;
    githubInstallationId: string;
  }): Promise<number> {
    return db('repositories')
      .where({
        organization_id: organizationId,
        github_installation_id: githubInstallationId,
        is_active: true,
      })
      .update({
        is_active: false,
        updated_at: db.fn.now(),
      });
  }
}

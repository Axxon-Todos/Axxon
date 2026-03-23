// Persists org-scoped GitHub installation records and their lifecycle updates.
import db from '@/lib/db/db';
import type {
  GithubInstallationRecord,
  GithubInstallationStatus,
  GithubRepositorySelection,
} from '@/lib/types/githubIntegrationTypes';

type UpsertGithubInstallationInput = {
  organization_id: number;
  github_installation_id: string;
  github_account_id: string;
  github_account_login: string;
  github_account_type: string;
  repository_selection: GithubRepositorySelection;
  status: GithubInstallationStatus;
  installed_by_user_id?: number | null;
  last_synced_at?: string | Date | null;
};

export class GithubInstallations {
  static async getCurrentForOrganization(
    organizationId: number
  ): Promise<GithubInstallationRecord | null> {
    return (
      (await db('github_installations')
        .where({ organization_id: organizationId })
        .whereNot({ status: 'removed' })
        .orderByRaw(
          `CASE status
            WHEN 'active' THEN 0
            WHEN 'suspended' THEN 1
            WHEN 'pending' THEN 2
            ELSE 3
          END`
        )
        .orderBy('updated_at', 'desc')
        .first()) ?? null
    );
  }

  static async getByGithubInstallationId(
    githubInstallationId: string
  ): Promise<GithubInstallationRecord | null> {
    return (
      (await db('github_installations')
        .where({ github_installation_id: githubInstallationId })
        .first()) ?? null
    );
  }

  static async markOtherInstallationsRemovedForOrganization(
    organizationId: number,
    keepGithubInstallationId: string
  ) {
    await db('github_installations')
      .where({ organization_id: organizationId })
      .whereNot({ github_installation_id: keepGithubInstallationId })
      .whereNot({ status: 'removed' })
      .update({
        status: 'removed',
        updated_at: db.fn.now(),
      });
  }

  static async upsertInstallation(
    data: UpsertGithubInstallationInput
  ): Promise<GithubInstallationRecord> {
    const [installation] = await db('github_installations')
      .insert({
        ...data,
        installed_by_user_id: data.installed_by_user_id ?? null,
        last_synced_at: data.last_synced_at ?? null,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .onConflict(['github_installation_id'])
      .merge({
        organization_id: data.organization_id,
        github_account_id: data.github_account_id,
        github_account_login: data.github_account_login,
        github_account_type: data.github_account_type,
        repository_selection: data.repository_selection,
        status: data.status,
        installed_by_user_id: data.installed_by_user_id ?? null,
        last_synced_at: data.last_synced_at ?? null,
        updated_at: db.fn.now(),
      })
      .returning('*');

    return installation;
  }

  static async updateStatusByGithubInstallationId(
    githubInstallationId: string,
    status: GithubInstallationStatus
  ): Promise<GithubInstallationRecord | null> {
    const [installation] = await db('github_installations')
      .where({ github_installation_id: githubInstallationId })
      .update({
        status,
        updated_at: db.fn.now(),
      })
      .returning('*');

    return installation ?? null;
  }

  static async touchSyncByGithubInstallationId(
    githubInstallationId: string
  ): Promise<void> {
    await db('github_installations')
      .where({ github_installation_id: githubInstallationId })
      .update({
        last_synced_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
  }
}

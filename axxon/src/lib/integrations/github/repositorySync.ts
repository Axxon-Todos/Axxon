// Syncs repositories from a GitHub installation into the org-owned repositories table.
import { getGitHubInstallationDetails } from '@/lib/github/appAuth';
import { createGitHubInstallationAccessToken } from '@/lib/github/appAuth';
import { githubJsonRequest } from '@/lib/github/apiClient';
import { GithubInstallations } from '@/lib/models/githubInstallations';
import { Repositories } from '@/lib/models/repositories';

type GitHubRepositoryPayload = {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  default_branch: string | null;
  private: boolean;
  archived: boolean;
  html_url: string;
};

type GitHubInstallationRepositoriesResponse = {
  total_count: number;
  repositories: GitHubRepositoryPayload[];
};

function normalizeGitHubId(value: string | number, label: string) {
  if (value === null || value === undefined) {
    throw new Error(`Missing ${label}`);
  }

  return String(value);
}

export async function syncRepositoriesForInstallation({
  organizationId,
  githubInstallationId,
}: {
  organizationId: number;
  githubInstallationId: string;
}) {
  const installationToken = await createGitHubInstallationAccessToken(
    githubInstallationId
  );
  const normalizedInstallation = await getGitHubInstallationDetails(
    githubInstallationId
  );
  const repositories: GitHubRepositoryPayload[] = [];
  let page = 1;

  while (true) {
    const response = await githubJsonRequest<GitHubInstallationRepositoriesResponse>(
      `/installation/repositories?per_page=100&page=${page}`,
      {
        token: installationToken,
      }
    );

    repositories.push(...response.repositories);

    if (
      response.repositories.length === 0 ||
      repositories.length >= response.total_count
    ) {
      break;
    }

    page += 1;
  }

  const upserts = repositories.map((repository) => ({
    organization_id: organizationId,
    github_installation_id: normalizeGitHubId(
      normalizedInstallation.id,
      'installation id'
    ),
    github_repo_id: normalizeGitHubId(repository.id, 'repository id'),
    name: repository.name,
    full_name: repository.full_name,
    owner_login: repository.owner.login,
    default_branch: repository.default_branch ?? null,
    private: repository.private,
    archived: repository.archived,
    html_url: repository.html_url,
    is_active: true,
    raw_json: repository as unknown as Record<string, unknown>,
  }));

  await Repositories.upsertRepositories(upserts);

  const deactivatedCount = await Repositories.deactivateMissingForInstallation({
    organizationId,
    githubInstallationId,
    activeGithubRepoIds: upserts.map((repository) => repository.github_repo_id),
  });

  await GithubInstallations.touchSyncByGithubInstallationId(githubInstallationId);

  return {
    syncedCount: upserts.length,
    deactivatedCount,
  };
}

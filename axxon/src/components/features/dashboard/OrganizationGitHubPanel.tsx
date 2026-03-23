'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderGit2, RefreshCcw, ShieldCheck } from 'lucide-react';
import { getOrganizationRepositories } from '@/lib/api/integrations/github/getOrganizationRepositories';
import { startGitHubInstall } from '@/lib/api/integrations/github/startGitHubInstall';
import { syncGitHubRepositories } from '@/lib/api/integrations/github/syncGitHubRepositories';
import { redirectBrowserTo } from '@/lib/utils/browser';

export default function OrganizationGitHubPanel({
  organizationId,
  isOwner,
}: {
  organizationId: string;
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['organization-repositories', organizationId],
    queryFn: () => getOrganizationRepositories(organizationId),
  });

  const installMutation = useMutation({
    mutationFn: () => startGitHubInstall(organizationId),
    onSuccess: (response) => {
      redirectBrowserTo(response.installUrl);
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => syncGitHubRepositories(organizationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['organization-repositories', organizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['organization', organizationId],
      });
    },
  });

  const installation = data?.installation ?? null;
  const repositories = data?.repositories ?? [];

  return (
    <article className="glass-panel-strong rounded-[2rem] p-6 sm:p-8">
      <p className="app-kicker">Connected Repos</p>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            GitHub App connection
          </h2>
          <p className="mt-4 max-w-2xl leading-7 app-text-muted">
            Connect a GitHub App installation to this organization, then sync the
            repositories currently accessible to that installation.
          </p>
        </div>

        {isOwner ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending}
              className="glass-button glass-button-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {installMutation.isPending ? 'Redirecting...' : 'Connect GitHub'}
            </button>

            {installation ? (
              <button
                type="button"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || installation.status !== 'active'}
                className="glass-button disabled:cursor-not-allowed disabled:opacity-70"
              >
                {syncMutation.isPending ? 'Syncing...' : 'Sync Repositories'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {installation ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="app-badge">
            <ShieldCheck className="h-3.5 w-3.5" />
            {installation.github_account_login}
          </span>
          <span className="app-badge">
            <RefreshCcw className="h-3.5 w-3.5" />
            {installation.status}
          </span>
          <span className="app-badge">
            <FolderGit2 className="h-3.5 w-3.5" />
            {repositories.length} active repos
          </span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-[var(--app-border)] p-5 text-sm app-text-muted">
          Loading GitHub connection...
        </div>
      ) : installation ? (
        repositories.length > 0 ? (
          <div className="mt-6 space-y-3">
            {repositories.map((repository) => (
              <a
                key={repository.github_repo_id}
                href={repository.html_url}
                target="_blank"
                rel="noreferrer"
                className="glass-panel flex items-center justify-between rounded-2xl px-4 py-3"
              >
                <div>
                  <p className="font-medium">{repository.full_name}</p>
                  <p className="text-sm app-text-muted">
                    Default branch: {repository.default_branch || 'Not set'}
                  </p>
                </div>
                <div className="flex gap-2 text-sm app-text-muted">
                  <span>{repository.private ? 'Private' : 'Public'}</span>
                  <span>{repository.archived ? 'Archived' : 'Active'}</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[1.5rem] border border-dashed border-[var(--app-border)] p-5 text-sm app-text-muted">
            GitHub is connected, but no active repositories have been synced into this organization yet.
          </div>
        )
      ) : (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-[var(--app-border)] p-5 text-sm app-text-muted">
          {isOwner
            ? 'No GitHub App installation is connected yet.'
            : 'No GitHub App installation is connected to this organization yet.'}
        </div>
      )}

      {installMutation.error ? (
        <p className="mt-4 text-sm text-red-400">
          {installMutation.error instanceof Error
            ? installMutation.error.message
            : 'Failed to start GitHub installation.'}
        </p>
      ) : null}

      {syncMutation.error ? (
        <p className="mt-4 text-sm text-red-400">
          {syncMutation.error instanceof Error
            ? syncMutation.error.message
            : 'Failed to sync GitHub repositories.'}
        </p>
      ) : null}
    </article>
  );
}

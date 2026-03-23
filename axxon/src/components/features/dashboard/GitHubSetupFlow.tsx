'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { finalizeGitHubInstallationRequest } from '@/lib/api/integrations/github/finalizeGitHubInstallation';
import { redirectBrowserTo } from '@/lib/utils/browser';
import { buildOrganizationPath } from '@/lib/utils/routes';
import type { GithubFinalizeSuccess } from '@/lib/types/githubIntegrationTypes';

type FlowState =
  | {
      phase: 'loading' | 'redirecting';
      message: string;
    }
  | {
      phase: 'success';
      data: GithubFinalizeSuccess;
    }
  | {
      phase: 'error';
      message: string;
    };

export default function GitHubSetupFlow({
  organizationId,
}: {
  organizationId: string;
}) {
  const searchParams = useSearchParams();
  const [flowState, setFlowState] = useState<FlowState>({
    phase: 'loading',
    message: 'Preparing GitHub installation finalization...',
  });

  const installationId = searchParams.get('installation_id') ?? '';
  const setupAction = searchParams.get('setup_action');
  const state = searchParams.get('state') ?? '';
  const verificationToken = searchParams.get('verification_token') ?? '';
  const callbackError = searchParams.get('error');

  useEffect(() => {
    let isCancelled = false;

    async function finalize() {
      if (callbackError) {
        setFlowState({
          phase: 'error',
          message: `GitHub authorization failed: ${callbackError}`,
        });
        return;
      }

      if (!installationId || !state) {
        setFlowState({
          phase: 'error',
          message: 'Missing required GitHub setup parameters.',
        });
        return;
      }

      try {
        const response = await finalizeGitHubInstallationRequest(organizationId, {
          installationId,
          setupAction:
            setupAction === 'install' || setupAction === 'update'
              ? setupAction
              : null,
          state,
          verificationToken: verificationToken || undefined,
        });

        if (isCancelled) {
          return;
        }

        if (response.status === 'authorization_required') {
          setFlowState({
            phase: 'redirecting',
            message: 'Redirecting to GitHub to verify installation access...',
          });
          redirectBrowserTo(response.authorizationUrl);
          return;
        }

        setFlowState({
          phase: 'success',
          data: response,
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setFlowState({
          phase: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to finalize the GitHub installation.',
        });
      }
    }

    void finalize();

    return () => {
      isCancelled = true;
    };
  }, [
    callbackError,
    installationId,
    organizationId,
    setupAction,
    state,
    verificationToken,
  ]);

  if (flowState.phase === 'loading' || flowState.phase === 'redirecting') {
    return (
      <div className="mx-auto max-w-[920px]">
        <section className="glass-panel-strong rounded-[2rem] p-8 sm:p-10">
          <p className="app-kicker">GitHub Setup</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Finalizing GitHub connection
          </h1>
          <p className="mt-4 max-w-2xl leading-7 app-text-muted">
            {flowState.message}
          </p>
        </section>
      </div>
    );
  }

  if (flowState.phase === 'error') {
    return (
      <div className="mx-auto max-w-[920px]">
        <section className="glass-panel-strong rounded-[2rem] p-8 sm:p-10">
          <p className="app-kicker">GitHub Setup</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            GitHub connection failed
          </h1>
          <p className="mt-4 max-w-2xl leading-7 app-text-muted">
            {flowState.message}
          </p>
          <div className="mt-6">
            <Link
              href={buildOrganizationPath(organizationId)}
              className="glass-button glass-button-primary"
            >
              Return to Organization
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (flowState.phase !== 'success') {
    return null;
  }

  const successState = flowState;

  return (
    <div className="mx-auto max-w-[920px]">
      <section className="glass-panel-strong rounded-[2rem] p-8 sm:p-10">
        <p className="app-kicker">GitHub Setup</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          GitHub is connected
        </h1>
        <p className="mt-4 max-w-2xl leading-7 app-text-muted">
          {successState.data.installation.github_account_login} is now linked to this
          organization. {successState.data.repositoriesSynced} repositories were synced
          during setup.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="app-badge">{successState.data.installation.status}</span>
          <span className="app-badge">
            {successState.data.installation.repository_selection} repository access
          </span>
        </div>

        <div className="mt-6">
          <Link
            href={buildOrganizationPath(organizationId)}
            className="glass-button glass-button-primary"
          >
            Open Organization Workspace
          </Link>
        </div>
      </section>
    </div>
  );
}

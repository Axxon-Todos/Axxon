import { redirect } from 'next/navigation';
import { verifyGitHubInstallStateToken } from '@/lib/integrations/github/state';
import { buildOrganizationGitHubSetupPath } from '@/lib/utils/routes';

type GitHubSetupBridgePageProps = {
  searchParams: Promise<{
    installation_id?: string;
    setup_action?: string;
    state?: string;
  }>;
};

function renderBridgeError(message: string) {
  return (
    <div className="mx-auto max-w-[840px]">
      <section className="glass-panel-strong rounded-[2rem] p-8">
        <p className="app-kicker">GitHub Setup</p>
        <h1 className="mt-3 text-3xl font-semibold">GitHub setup could not continue</h1>
        <p className="mt-4 max-w-2xl leading-7 app-text-muted">{message}</p>
      </section>
    </div>
  );
}

export default async function GitHubSetupBridgePage({
  searchParams,
}: GitHubSetupBridgePageProps) {
  const { installation_id, setup_action, state } = await searchParams;

  if (!installation_id || !state) {
    return renderBridgeError('Missing required GitHub setup parameters.');
  }

  let installState: Awaited<ReturnType<typeof verifyGitHubInstallStateToken>>;

  try {
    installState = await verifyGitHubInstallStateToken(state);
  } catch {
    return renderBridgeError('The GitHub setup state is invalid or has expired.');
  }

  const redirectParams = new URLSearchParams({
    installation_id,
    state,
  });

  if (setup_action) {
    redirectParams.set('setup_action', setup_action);
  }

  redirect(
    `${buildOrganizationGitHubSetupPath(
      installState.organizationId
    )}?${redirectParams.toString()}`
  );
}

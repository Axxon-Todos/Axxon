// Loads the org-scoped AI workspace and passes the active runtime summary into the client shell.
import OrganizationAiWorkspace from '@/components/features/organizationAi/OrganizationAiWorkspace';
import { getAiRuntimeSummary } from '@/lib/ai/config';

type OrganizationAiPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function OrganizationAiPage({
  params,
}: OrganizationAiPageProps) {
  const { organizationId } = await params;

  // Resolve the runtime summary server-side so the initial page render reflects the active provider.
  return (
    <OrganizationAiWorkspace
      organizationId={organizationId}
      runtime={getAiRuntimeSummary()}
    />
  );
}

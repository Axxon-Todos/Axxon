import GitHubSetupFlow from '@/components/features/dashboard/GitHubSetupFlow';

type OrganizationGitHubSetupPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function OrganizationGitHubSetupPage({
  params,
}: OrganizationGitHubSetupPageProps) {
  const { organizationId } = await params;

  return <GitHubSetupFlow organizationId={organizationId} />;
}

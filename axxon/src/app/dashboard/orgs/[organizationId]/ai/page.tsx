// Hosts the org-level AI planning workspace while agent runs remain scoped to selected boards.
import PlanningWorkspace from '@/components/features/agents/PlanningWorkspace';

type OrganizationAiPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function OrganizationAiPage({
  params,
}: OrganizationAiPageProps) {
  const { organizationId } = await params;

  return <PlanningWorkspace organizationId={organizationId} />;
}

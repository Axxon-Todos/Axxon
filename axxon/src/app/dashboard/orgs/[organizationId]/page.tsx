import OrganizationWorkspace from '@/components/features/dashboard/OrganizationWorkspace';

type OrganizationPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const { organizationId } = await params;

  return <OrganizationWorkspace organizationId={organizationId} />;
}

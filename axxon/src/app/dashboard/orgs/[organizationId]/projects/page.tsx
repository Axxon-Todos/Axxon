// Lists architecture projects inside an organization.
import ProjectsPageClient from '@/components/features/projects/ProjectsPageClient';

export default async function ProjectsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  return <ProjectsPageClient organizationId={organizationId} />;
}

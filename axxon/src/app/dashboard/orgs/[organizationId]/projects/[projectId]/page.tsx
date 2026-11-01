// Hosts the canonical architecture canvas for an organization project.
import ArchitectureWorkspace from '@/components/features/projects/ArchitectureWorkspace';

export default async function ProjectArchitecturePage({ params }: { params: Promise<{ organizationId: string; projectId: string }> }) {
  const { organizationId, projectId } = await params;
  return <ArchitectureWorkspace organizationId={organizationId} projectId={projectId} />;
}

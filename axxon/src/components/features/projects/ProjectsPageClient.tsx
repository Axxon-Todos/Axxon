// Owns project-directory modal state after the server route resolves organization parameters.
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ProjectDirectory from '@/components/features/projects/ProjectDirectory';
import CreateProjectForm from '@/components/features/projects/CreateProjectForm';
import Modal from '@/components/ui/Modal';

export default function ProjectsPageClient({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  return (
    <>
      <div className="app-page"><ProjectDirectory organizationId={organizationId} onCreate={() => setIsCreateOpen(true)} /></div>
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create architecture project">
        <CreateProjectForm organizationId={organizationId} onClose={(projectId) => { setIsCreateOpen(false); if (projectId) router.push(`/dashboard/orgs/${organizationId}/projects/${projectId}`); }} />
      </Modal>
    </>
  );
}

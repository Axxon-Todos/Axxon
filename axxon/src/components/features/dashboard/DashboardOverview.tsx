// Gives members a clear overview of their organizations and the boards inside the selected workspace.
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Building2, FolderKanban, GitBranch, Plus } from 'lucide-react';

import CreateBoardForm from '@/components/features/dashboard/CreateBoardForm';
import CreateOrganizationForm from '@/components/features/dashboard/CreateOrganizationForm';
import DashboardProjects from '@/components/features/dashboard/DashboardProjects';
import OrganizationList from '@/components/features/dashboard/OrganizationList';
import Button from '@/components/ui/Button';
import GoogleLoginButton from '@/components/ui/GoogleLoginButton';
import Modal from '@/components/ui/Modal';
import PageHero from '@/components/ui/PageHero';
import Surface from '@/components/ui/Surface';
import { fetchOrganizations } from '@/lib/api/organizations/getOrganizations';
import { getUserId } from '@/lib/api/users/getUserId';

// Renders the org-first dashboard with one selected workspace and its boards.
export default function DashboardOverview() {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(null);
  const [isCreateOrganizationOpen, setIsCreateOrganizationOpen] = useState(false);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  const { data: userId, isLoading: isUserLoading } = useQuery({
    queryKey: ['id'],
    queryFn: getUserId,
    staleTime: 5 * 60 * 1000,
  });
  const { data: organizations = [], isLoading: isOrganizationsLoading, isError: isOrganizationsError } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  if (isUserLoading) {
    return <div className="app-page"><Surface variant="strong" className="p-8 text-sm app-text-muted">Loading your workspace...</Surface></div>;
  }

  if (!userId) {
    return (
      <div className="app-page">
        <Surface variant="strong" className="p-8">
          <p className="app-kicker">Workspace</p>
          <h1 className="mt-3 text-3xl font-semibold">Sign in to access your organizations</h1>
          <p className="mt-3 max-w-2xl app-text-muted">Your organizations and boards will appear here once you sign in.</p>
          <GoogleLoginButton variant="app" className="mt-6" />
        </Surface>
      </div>
    );
  }

  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId)
    ?? organizations[0]
    ?? null;
  const totalBoards = organizations.reduce((total, organization) => total + organization.accessible_board_count, 0);
  const totalRepositories = organizations.reduce((total, organization) => total + organization.repo_count, 0);

  return (
    <>
      <div className="app-page w-full">
        <PageHero
          kicker="Your workspace"
          title="Organizations & projects"
          description="Choose an organization to see its boards and continue where your team is working."
          actions={<Button variant="primary" onClick={() => setIsCreateOrganizationOpen(true)}><Plus className="h-4 w-4" /> Create organization</Button>}
        >
          <div className="grid border-t border-[var(--app-border)] pt-5 sm:grid-cols-3">
            <div className="flex items-center gap-4 py-2 sm:pr-6">
              <Building2 className="h-5 w-5 text-[var(--app-muted)]" />
              <div><p className="text-2xl font-semibold tabular-nums">{isOrganizationsLoading ? '—' : organizations.length}</p><p className="text-xs app-text-muted">Organizations</p></div>
            </div>
            <div className="flex items-center gap-4 border-t border-[var(--app-border)] py-3 sm:border-l sm:border-t-0 sm:px-6">
              <FolderKanban className="h-5 w-5 text-[var(--app-muted)]" />
              <div><p className="text-2xl font-semibold tabular-nums">{isOrganizationsLoading ? '—' : totalBoards}</p><p className="text-xs app-text-muted">Accessible boards</p></div>
            </div>
            <div className="flex items-center gap-4 border-t border-[var(--app-border)] py-3 sm:border-l sm:border-t-0 sm:pl-6">
              <GitBranch className="h-5 w-5 text-[var(--app-muted)]" />
              <div><p className="text-2xl font-semibold tabular-nums">{isOrganizationsLoading ? '—' : totalRepositories}</p><p className="text-xs app-text-muted">Connected repositories</p></div>
            </div>
          </div>
        </PageHero>

        <motion.section
          aria-label="Organization and board directory"
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]"
        >
          <Surface variant="strong" className="flex min-h-[520px] min-w-0 flex-col overflow-hidden">
            <OrganizationList
              organizations={organizations}
              selectedOrganizationId={selectedOrganization?.id ?? null}
              onSelect={setSelectedOrganizationId}
              isLoading={isOrganizationsLoading}
              isError={isOrganizationsError}
            />
          </Surface>
          <Surface variant="strong" className="min-h-[520px] min-w-0 overflow-hidden">
            {isOrganizationsLoading ? (
              <div className="space-y-4 p-6" aria-label="Loading projects">
                <div className="h-8 w-1/2 animate-pulse rounded-md bg-[var(--app-panel-soft)] motion-reduce:animate-none" />
                <div className="h-24 animate-pulse rounded-md bg-[var(--app-panel-soft)] motion-reduce:animate-none" />
                <div className="h-48 animate-pulse rounded-md bg-[var(--app-panel-soft)] motion-reduce:animate-none" />
              </div>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <DashboardProjects
                  key={selectedOrganization?.id ?? 'none'}
                  organization={selectedOrganization}
                  onCreateBoard={() => setIsCreateBoardOpen(true)}
                />
              </AnimatePresence>
            )}
          </Surface>
        </motion.section>
      </div>

      <Modal isOpen={isCreateOrganizationOpen} onClose={() => setIsCreateOrganizationOpen(false)} title="Create organization">
        <CreateOrganizationForm onClose={() => setIsCreateOrganizationOpen(false)} />
      </Modal>
      {selectedOrganization ? (
        <Modal isOpen={isCreateBoardOpen} onClose={() => setIsCreateBoardOpen(false)} title="Create board">
          <CreateBoardForm organizationId={String(selectedOrganization.id)} onClose={() => setIsCreateBoardOpen(false)} />
        </Modal>
      ) : null}
    </>
  );
}

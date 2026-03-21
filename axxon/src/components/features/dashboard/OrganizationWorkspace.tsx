'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderGit2, Users2 } from 'lucide-react';

import BoardList from '@/components/features/dashboard/BoardList';
import CreateBoardForm from '@/components/features/dashboard/CreateBoardForm';
import EditOrganizationModal from '@/components/features/dashboard/EditOrganizationModal';
import Modal from '@/components/ui/Modal';
import { fetchOrganization } from '@/lib/api/organizations/getOrganization';
import { fetchOrganizationMembers } from '@/lib/api/organizations/getOrganizationMembers';
import { getUserId } from '@/lib/api/users/getUserId';

import type { OrganizationMemberRecord } from '@/lib/types/organizationMemberTypes';

export default function OrganizationWorkspace({
  organizationId,
}: {
  organizationId: string;
}) {
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);
  const [isEditOrganizationModalOpen, setIsEditOrganizationModalOpen] = useState(false);

  const { data: organization, isLoading: isOrganizationLoading } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: () => fetchOrganization(organizationId),
  });

  const { data: userId } = useQuery({
    queryKey: ['id'],
    queryFn: getUserId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: members = [], isLoading: isMembersLoading } = useQuery<
    OrganizationMemberRecord[]
  >({
    queryKey: ['organization-members', organizationId],
    queryFn: () => fetchOrganizationMembers(organizationId),
  });

  if (isOrganizationLoading || !organization) {
    return (
      <div className="mx-auto max-w-[1480px]">
        <section className="glass-panel-strong rounded-[2rem] p-8">
          <p className="app-kicker">Organization</p>
          <h1 className="mt-3 text-3xl font-semibold">Loading organization...</h1>
        </section>
      </div>
    );
  }

  const isOwner = members.some(
    (member) => String(member.id) === userId && member.role === 'owner'
  );

  return (
    <>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
        <section
          className="glass-panel-strong rounded-[2rem] p-8 sm:p-10"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${organization.color || '#0f766e'} 16%, var(--app-panel-strong)), var(--app-panel-strong))`,
          }}
        >
          <p className="app-kicker">Organization Workspace</p>
          <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: organization.color || '#0f766e' }}
                />
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  {organization.name}
                </h1>
              </div>
              <p className="mt-4 max-w-3xl text-base leading-7 app-text-muted">
                {organization.description ||
                  'Top-level workspace for coordinating members, board execution surfaces, connected repositories, and future agent history.'}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="app-badge">
                  <FolderGit2 className="h-3.5 w-3.5" />
                  {organization.accessible_board_count} boards in scope
                </span>
                <span className="app-badge">
                  <Users2 className="h-3.5 w-3.5" />
                  {organization.member_count} members
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsCreateBoardModalOpen(true)}
                className="glass-button glass-button-primary"
              >
                Create Board
              </button>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => setIsEditOrganizationModalOpen(true)}
                  className="glass-button"
                >
                  Edit Organization
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="glass-panel-strong rounded-[2rem] p-6 sm:p-8">
          <BoardList organizationId={organizationId} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="glass-panel-strong rounded-[2rem] p-6 sm:p-8">
            <p className="app-kicker">Connected Repos</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Repo connection setup comes next
            </h2>
            <p className="mt-4 max-w-2xl leading-7 app-text-muted">
              This phase only establishes the org boundary. Repository onboarding will plug into this section after the org-first board flow is stable.
            </p>
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-[var(--app-border)] p-5 text-sm app-text-muted">
              No repositories connected yet.
            </div>
          </article>

          <article className="glass-panel-strong rounded-[2rem] p-6 sm:p-8">
            <p className="app-kicker">Members</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Organization access
            </h2>

            <div className="mt-6 space-y-3">
              {isMembersLoading ? (
                <div className="glass-panel rounded-2xl px-4 py-3 text-sm app-text-muted">
                  Loading members...
                </div>
              ) : members.length === 0 ? (
                <div className="glass-panel rounded-2xl px-4 py-3 text-sm app-text-muted">
                  No members yet.
                </div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="glass-panel flex items-center justify-between rounded-2xl px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        {[member.first_name, member.last_name].filter(Boolean).join(' ') || member.email}
                      </p>
                      <p className="text-sm app-text-muted">{member.email}</p>
                    </div>
                    <span className="app-badge">{member.role}</span>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </div>

      <Modal
        isOpen={isCreateBoardModalOpen}
        onClose={() => setIsCreateBoardModalOpen(false)}
        title="Create New Board"
      >
        <CreateBoardForm
          organizationId={organizationId}
          onClose={() => setIsCreateBoardModalOpen(false)}
        />
      </Modal>

      {isEditOrganizationModalOpen ? (
        <EditOrganizationModal
          organization={organization}
          onClose={() => setIsEditOrganizationModalOpen(false)}
        />
      ) : null}
    </>
  );
}

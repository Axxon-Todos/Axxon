// Renders the org workspace using the shared hero layout and refreshed product surfaces.
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderGit2, Sparkles, Users2 } from 'lucide-react';

import BoardList from '@/components/features/dashboard/BoardList';
import CreateBoardForm from '@/components/features/dashboard/CreateBoardForm';
import EditOrganizationModal from '@/components/features/dashboard/EditOrganizationModal';
import InviteOrganizationMembersModal from '@/components/features/dashboard/InviteOrganizationMembersModal';
import OrganizationGitHubPanel from '@/components/features/dashboard/OrganizationGitHubPanel';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PageHero from '@/components/ui/PageHero';
import Surface from '@/components/ui/Surface';
import { fetchOrganization } from '@/lib/api/organizations/getOrganization';
import { fetchOrganizationMembers } from '@/lib/api/organizations/getOrganizationMembers';
import { getUserId } from '@/lib/api/users/getUserId';
import { resolveAccentColor } from '@/lib/utils/brandColors';
import { buildOrganizationAiPath } from '@/lib/utils/routes';

import type { OrganizationMemberRecord } from '@/lib/types/organizationMemberTypes';

export default function OrganizationWorkspace({
  organizationId,
}: {
  organizationId: string;
}) {
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);
  const [isEditOrganizationModalOpen, setIsEditOrganizationModalOpen] = useState(false);
  const [isInviteMembersModalOpen, setIsInviteMembersModalOpen] = useState(false);

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
      <div className="app-page">
        <Surface variant="strong" className="rounded-[2rem] p-8">
          <p className="app-kicker">Organization</p>
          <h1 className="mt-3 text-3xl font-semibold">Loading organization...</h1>
        </Surface>
      </div>
    );
  }

  const isOwner = members.some(
    (member) => String(member.id) === userId && member.role === 'owner'
  );

  return (
    <>
      <div className="app-page">
        <PageHero
          kicker="Organization Workspace"
          title={organization.name}
          description={
            organization.description ||
            'Top-level workspace for coordinating members, board execution surfaces, connected repositories, and future agent history.'
          }
          accentColor={resolveAccentColor(organization.color)}
          actions={
            <>
              <Link
                href={buildOrganizationAiPath(organizationId)}
                className="app-button app-button-primary"
              >
                <Sparkles className="h-4 w-4" />
                Open AI Workspace
              </Link>
              <Button variant="primary" onClick={() => setIsCreateBoardModalOpen(true)}>
                Create Board
              </Button>
              {isOwner ? (
                <Button onClick={() => setIsEditOrganizationModalOpen(true)}>
                  Edit Organization
                </Button>
              ) : null}
            </>
          }
          badges={
            <>
              <Badge>
                <FolderGit2 className="h-3.5 w-3.5" />
                {organization.accessible_board_count} boards in scope
              </Badge>
              <Badge>
                <Users2 className="h-3.5 w-3.5" />
                {organization.member_count} members
              </Badge>
            </>
          }
        />

        <Surface variant="strong" className="rounded-[2rem] p-6 sm:p-8">
          <BoardList organizationId={organizationId} />
        </Surface>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <OrganizationGitHubPanel organizationId={organizationId} isOwner={isOwner} />

          <Surface variant="strong" className="rounded-[2rem] p-6 sm:p-8">
            <p className="app-kicker">Members</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Organization access
            </h2>
            {isOwner ? (
              <div className="mt-4">
                <Button onClick={() => setIsInviteMembersModalOpen(true)}>
                  Invite Members
                </Button>
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {isMembersLoading ? (
                <Surface variant="default" className="rounded-2xl px-4 py-3 text-sm app-text-muted">
                  Loading members...
                </Surface>
              ) : members.length === 0 ? (
                <Surface variant="default" className="rounded-2xl px-4 py-3 text-sm app-text-muted">
                  No members yet.
                </Surface>
              ) : (
                members.map((member) => (
                  <Surface
                    key={member.id}
                    variant="default"
                    className="flex items-center justify-between rounded-2xl px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        {[member.first_name, member.last_name].filter(Boolean).join(' ') || member.email}
                      </p>
                      <p className="text-sm app-text-muted">{member.email}</p>
                    </div>
                    <Badge>{member.role}</Badge>
                  </Surface>
                ))
              )}
            </div>
          </Surface>
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

      {isInviteMembersModalOpen ? (
        <InviteOrganizationMembersModal
          organizationId={organizationId}
          onClose={() => setIsInviteMembersModalOpen(false)}
        />
      ) : null}
    </>
  );
}

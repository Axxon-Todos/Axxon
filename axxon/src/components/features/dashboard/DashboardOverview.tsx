// Renders the top-level organization dashboard and introduces the new shared hero and metrics styling.
'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderGit2, ShieldCheck, Users2 } from 'lucide-react';

import CreateOrganizationForm from '@/components/features/dashboard/CreateOrganizationForm';
import OrganizationList from '@/components/features/dashboard/OrganizationList';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PageHero from '@/components/ui/PageHero';
import Surface from '@/components/ui/Surface';
import { fetchOrganizations } from '@/lib/api/organizations/getOrganizations';
import { getUserId } from '@/lib/api/users/getUserId';

export default function DashboardOverview() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: userId, isLoading: isUserLoading } = useQuery({
    queryKey: ['id'],
    queryFn: getUserId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  if (!isUserLoading && !userId) {
    return (
      <div className="app-page">
        <Surface variant="strong" className="rounded-[2rem] p-8">
          <p className="app-kicker">Organizations</p>
          <h1 className="mt-3 text-3xl font-semibold">Sign in to access your organizations</h1>
          <p className="mt-3 max-w-2xl app-text-muted">
            Organization boundaries sit above boards so repo context, members, and AI work stay coordinated.
          </p>
        </Surface>
      </div>
    );
  }

  const totalBoards = organizations.reduce(
    (sum, organization) => sum + organization.accessible_board_count,
    0
  );
  const totalMembers = organizations.reduce(
    (sum, organization) => sum + organization.member_count,
    0
  );

  return (
    <>
      <div className="app-page">
        <PageHero
          kicker="Organizations"
          title="Choose the organization boundary before you enter execution."
          description="Axxon treats organizations as the top-level workspace. Boards live inside those orgs so members, repo context, and AI-assisted work stay aligned in one system."
          accentColor="#2fd087"
          actions={
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              Create Organization
            </Button>
          }
          badges={
            <>
              <Badge>
                <ShieldCheck className="h-3.5 w-3.5" />
                Org-first architecture
              </Badge>
              <Badge>
                <FolderGit2 className="h-3.5 w-3.5" />
                Repo-aware workspaces
              </Badge>
            </>
          }
        >
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Organizations"
              value={organizations.length}
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <MetricCard
              label="Accessible Boards"
              value={totalBoards}
              icon={<FolderGit2 className="h-5 w-5" />}
            />
            <MetricCard
              label="Members in Scope"
              value={totalMembers}
              icon={<Users2 className="h-5 w-5" />}
            />
          </div>
        </PageHero>

        <Surface variant="strong" className="rounded-[2rem] p-6 sm:p-8">
          <div className="mb-6">
            <p className="app-kicker">Directory</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Your organizations
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 app-text-muted">
              Open an organization to manage boards, members, and the execution surfaces inside it.
            </p>
          </div>

          <OrganizationList />
        </Surface>
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Organization"
      >
        <CreateOrganizationForm onClose={() => setIsCreateModalOpen(false)} />
      </Modal>
    </>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <Surface variant="default" className="rounded-[1.5rem] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium app-text-muted">{label}</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{value}</p>
        </div>
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--app-accent)]"
          style={{ background: 'color-mix(in srgb, var(--app-accent) 12%, transparent)' }}
        >
          {icon}
        </span>
      </div>
    </Surface>
  );
}

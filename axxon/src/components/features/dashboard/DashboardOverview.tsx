'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderGit2, ShieldCheck, Users2 } from 'lucide-react';

import Modal from '@/components/ui/Modal';
import CreateOrganizationForm from '@/components/features/dashboard/CreateOrganizationForm';
import OrganizationList from '@/components/features/dashboard/OrganizationList';
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
      <div className="mx-auto max-w-[1480px]">
        <section className="glass-panel-strong rounded-[2rem] p-8">
          <p className="app-kicker">Organizations</p>
          <h1 className="mt-3 text-3xl font-semibold">Sign in to access your organizations</h1>
          <p className="mt-3 max-w-2xl app-text-muted">
            Organization boundaries now sit above boards so repo context, members, and agent work stay coordinated.
          </p>
        </section>
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
      <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
        <section className="glass-panel-strong rounded-[2rem] p-8 sm:p-10">
          <p className="app-kicker">Organizations</p>
          <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Choose the organization boundary before you dive into boards.
              </h1>
              <p className="mt-4 text-base leading-7 app-text-muted">
                Axxon treats organizations as the top-level workspace. Boards live inside those orgs so members, repo context, and AI-assisted work stay aligned in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="glass-button glass-button-primary"
            >
              Create Organization
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
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
        </section>

        <section className="glass-panel-strong rounded-[2rem] p-6 sm:p-8">
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
        </section>
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
  icon: React.ReactNode;
}) {
  return (
    <article className="glass-panel rounded-[1.5rem] p-5">
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
    </article>
  );
}

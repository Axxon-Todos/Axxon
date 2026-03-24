// Renders board-level membership and repository access settings inside an org-scoped board route.
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderGit2, ShieldCheck, Users2 } from 'lucide-react';

import InviteMembersModal from '@/components/features/dashboard/InviteMembersModal';
import { getBoardRepositories } from '@/lib/api/boardRepositories/getBoardRepositories';
import { getOrganizationBoardRepositoryAccess } from '@/lib/api/boardRepositories/getOrganizationBoardRepositoryAccess';
import { updateBoardRepositories } from '@/lib/api/boardRepositories/updateBoardRepositories';
import { fetchBoardMembers } from '@/lib/api/boardMembers/getBoardMembers';
import { removeBoardMember } from '@/lib/api/boardMembers/removeBoardMember';
import { fetchBoard } from '@/lib/api/boards/getSingleBoard';
import { getOrganizationRepositories } from '@/lib/api/integrations/github/getOrganizationRepositories';
import { fetchOrganizationMembers } from '@/lib/api/organizations/getOrganizationMembers';
import { getUserId } from '@/lib/api/users/getUserId';
import { useOrganizationRouteParams } from '@/hooks/useOrganizationRouteParams';
import type { BoardRepositoryAccessMatrixResponse } from '@/lib/types/boardRepositoryAccessTypes';
import type { OrganizationMemberRecord } from '@/lib/types/organizationMemberTypes';
import type { User } from '@/lib/types/users';
import {
  buildOrganizationBoardAnalyticsPath,
  buildOrganizationBoardPath,
} from '@/lib/utils/routes';

function formatMemberName(member: Pick<User, 'first_name' | 'last_name' | 'email'>) {
  return [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || member.email;
}

function arraysMatch(left: number[], right: number[]) {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort((first, second) => first - second);
  const rightSorted = [...right].sort((first, second) => first - second);

  return leftSorted.every((value, index) => value === rightSorted[index]);
}

export default function BoardSettingsView({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationRouteParams();
  const [isInviteMembersModalOpen, setIsInviteMembersModalOpen] = useState(false);
  const [selectedRepositoryIds, setSelectedRepositoryIds] = useState<number[]>([]);
  const [repositoryError, setRepositoryError] = useState('');

  const { data: board } = useQuery({
    queryKey: ['board', organizationId, boardId],
    queryFn: () => fetchBoard(organizationId, boardId),
  });

  const { data: userId } = useQuery({
    queryKey: ['id'],
    queryFn: getUserId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: organizationMembers = [] } = useQuery<OrganizationMemberRecord[]>({
    queryKey: ['organization-members', organizationId],
    queryFn: () => fetchOrganizationMembers(organizationId),
  });

  const { data: boardMembers = [] } = useQuery<User[]>({
    queryKey: ['board-members', organizationId, boardId],
    queryFn: () => fetchBoardMembers(organizationId, boardId),
  });

  const { data: organizationRepositoriesResponse } = useQuery({
    queryKey: ['organization-repositories', organizationId],
    queryFn: () => getOrganizationRepositories(organizationId),
  });

  const { data: boardRepositoriesResponse } = useQuery({
    queryKey: ['board-repositories', organizationId, boardId],
    queryFn: () => getBoardRepositories(organizationId, boardId),
  });

  const isOwner = organizationMembers.some(
    (member) => String(member.id) === userId && member.role === 'owner'
  );
  const isCreator = Boolean(board && String(board.created_by) === userId);

  const ownerOverviewQuery = useQuery<BoardRepositoryAccessMatrixResponse>({
    queryKey: ['organization-board-repository-access', organizationId],
    queryFn: () => getOrganizationBoardRepositoryAccess(organizationId),
    enabled: isOwner,
  });

  const organizationMemberRoles = useMemo(
    () =>
      new Map(
        organizationMembers.map((member) => [member.id, member.role])
      ),
    [organizationMembers]
  );

  const boardRepositories = useMemo(
    () => boardRepositoriesResponse?.repositories ?? [],
    [boardRepositoriesResponse]
  );
  const organizationRepositories = useMemo(
    () => organizationRepositoriesResponse?.repositories ?? [],
    [organizationRepositoriesResponse]
  );

  useEffect(() => {
    const nextRepositoryIds = boardRepositories.map((repository) => repository.id);

    setSelectedRepositoryIds((current) =>
      arraysMatch(current, nextRepositoryIds) ? current : nextRepositoryIds
    );
  }, [boardRepositories]);

  const hasRepositoryChanges = !arraysMatch(
    selectedRepositoryIds,
    boardRepositories.map((repository) => repository.id)
  );

  const updateRepositoriesMutation = useMutation({
    mutationFn: () =>
      updateBoardRepositories({
        organizationId,
        boardId,
        repositoryIds: selectedRepositoryIds,
      }),
    onSuccess: async () => {
      setRepositoryError('');
      await queryClient.invalidateQueries({
        queryKey: ['board-repositories', organizationId, boardId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['organization-board-repository-access', organizationId],
      });
    },
    onError: (error) => {
      setRepositoryError(
        error instanceof Error ? error.message : 'Failed to update board repositories.'
      );
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: number) =>
      removeBoardMember({
        organizationId,
        boardId,
        userId: memberId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['board-members', organizationId, boardId],
      });
    },
  });

  const linkedBoardsByRepositoryId = useMemo(() => {
    const matrix = ownerOverviewQuery.data;

    if (!matrix) {
      return new Map<number, string[]>();
    }

    const boardsById = new Map(matrix.boards.map((entry) => [Number(entry.id), entry.name]));
    const nextMap = new Map<number, string[]>();

    for (const link of matrix.links) {
      const boardName = boardsById.get(link.board_id);
      if (!boardName) {
        continue;
      }

      const existingBoardNames = nextMap.get(link.repository_id) ?? [];
      nextMap.set(link.repository_id, [...existingBoardNames, boardName]);
    }

    return nextMap;
  }, [ownerOverviewQuery.data]);

  if (!board) {
    return (
      <div className="mx-auto max-w-[1480px]">
        <section className="glass-panel-strong rounded-[2rem] p-8">
          <p className="app-kicker">Board Settings</p>
          <h1 className="mt-3 text-3xl font-semibold">Loading board settings...</h1>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
        <section
          className="glass-panel-strong rounded-[2rem] p-8 sm:p-10"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${board.color || '#2563eb'} 16%, var(--app-panel-strong)), var(--app-panel-strong))`,
          }}
        >
          <p className="app-kicker">Board Settings</p>
          <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: board.color || '#2563eb' }}
                />
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  {board.name}
                </h1>
              </div>
              <p className="mt-4 max-w-3xl text-base leading-7 app-text-muted">
                Review board members, adjust repository access, and inspect how repositories are shared across boards.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="app-badge">
                  <Users2 className="h-3.5 w-3.5" />
                  {boardMembers.length} board members
                </span>
                <span className="app-badge">
                  <FolderGit2 className="h-3.5 w-3.5" />
                  {boardRepositories.length} linked repos
                </span>
                {isOwner ? (
                  <span className="app-badge">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Org owner
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={buildOrganizationBoardPath(organizationId, boardId)}
                className="glass-button"
              >
                Back to Board
              </Link>
              <Link
                href={buildOrganizationBoardAnalyticsPath(organizationId, boardId)}
                className="glass-button"
              >
                Analytics
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="glass-panel-strong rounded-[2rem] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Members</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  Board access
                </h2>
              </div>
              {isCreator ? (
                <button
                  type="button"
                  onClick={() => setIsInviteMembersModalOpen(true)}
                  className="glass-button"
                >
                  Add Members
                </button>
              ) : null}
            </div>

            <div className="mt-6 space-y-3">
              {boardMembers.map((member) => {
                const role = organizationMemberRoles.get(member.id);
                const isBoardCreator = String(member.id) === String(board.created_by);

                return (
                  <div
                    key={member.id}
                    className="glass-panel flex items-center justify-between gap-4 rounded-2xl px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{formatMemberName(member)}</p>
                      <p className="text-sm app-text-muted">{member.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {role ? <span className="app-badge">{role}</span> : null}
                      {isBoardCreator ? <span className="app-badge">creator</span> : null}
                      {isCreator && !isBoardCreator ? (
                        <button
                          type="button"
                          onClick={() => removeMemberMutation.mutate(member.id)}
                          disabled={removeMemberMutation.isPending}
                          className="glass-button !h-9 !px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="glass-panel-strong rounded-[2rem] p-6 sm:p-8">
            <div>
              <p className="app-kicker">Repositories</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Board repository access
              </h2>
              <p className="mt-4 max-w-2xl leading-7 app-text-muted">
                {isOwner
                  ? 'Choose which synced organization repositories this board should be allowed to use.'
                  : 'These are the repositories currently linked to this board.'}
              </p>
            </div>

            {organizationRepositories.length === 0 ? (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-[var(--app-border)] p-5 text-sm app-text-muted">
                No synced organization repositories are available yet.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {organizationRepositories.map((repository) => {
                  const isSelected = selectedRepositoryIds.includes(repository.id);
                  const linkedBoards = linkedBoardsByRepositoryId.get(repository.id) ?? [];

                  return (
                    <div
                      key={repository.id}
                      className="glass-panel rounded-2xl px-4 py-4"
                      style={
                        isSelected
                          ? {
                              borderColor:
                                'color-mix(in srgb, var(--app-accent) 28%, var(--app-border))',
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium">{repository.full_name}</p>
                          <p className="text-sm app-text-muted">
                            Default branch: {repository.default_branch || 'Not set'}
                          </p>
                          {isOwner ? (
                            <p className="mt-2 text-xs app-text-muted">
                              Linked boards:{' '}
                              {linkedBoards.length > 0 ? linkedBoards.join(', ') : 'None'}
                            </p>
                          ) : null}
                        </div>
                        {isOwner ? (
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setRepositoryError('');
                                setSelectedRepositoryIds((current) =>
                                  current.includes(repository.id)
                                    ? current.filter((value) => value !== repository.id)
                                    : [...current, repository.id]
                                );
                              }}
                            />
                            Access
                          </label>
                        ) : isSelected ? (
                          <span className="app-badge">Linked</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {repositoryError ? <p className="mt-4 text-sm text-rose-400">{repositoryError}</p> : null}

            {isOwner ? (
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => updateRepositoriesMutation.mutate()}
                  disabled={!hasRepositoryChanges || updateRepositoriesMutation.isPending}
                  className="glass-button glass-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateRepositoriesMutation.isPending ? 'Saving...' : 'Save Repository Access'}
                </button>
              </div>
            ) : null}
          </article>
        </section>

        {isOwner ? (
          <article className="glass-panel-strong rounded-[2rem] p-6 sm:p-8">
            <p className="app-kicker">Overview</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Board to repository access
            </h2>
            <div className="mt-6 space-y-3">
              {ownerOverviewQuery.isLoading ? (
                <div className="glass-panel rounded-2xl px-4 py-3 text-sm app-text-muted">
                  Loading repository access overview...
                </div>
              ) : ownerOverviewQuery.data?.repositories.length ? (
                ownerOverviewQuery.data.repositories.map((repository) => {
                  const linkedBoards = linkedBoardsByRepositoryId.get(repository.id) ?? [];

                  return (
                    <div
                      key={repository.id}
                      className="glass-panel flex flex-col gap-3 rounded-2xl px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div>
                        <p className="font-medium">{repository.full_name}</p>
                        <p className="text-sm app-text-muted">
                          {linkedBoards.length > 0
                            ? `${linkedBoards.length} board${linkedBoards.length === 1 ? '' : 's'} linked`
                            : 'No boards linked'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {linkedBoards.length > 0 ? (
                          linkedBoards.map((boardName) => (
                            <span key={`${repository.id}-${boardName}`} className="app-badge">
                              {boardName}
                            </span>
                          ))
                        ) : (
                          <span className="app-badge">No access</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="glass-panel rounded-2xl px-4 py-3 text-sm app-text-muted">
                  No synced repositories are available for overview yet.
                </div>
              )}
            </div>
          </article>
        ) : null}
      </div>

      {isInviteMembersModalOpen ? (
        <InviteMembersModal
          organizationId={Number(organizationId)}
          boardId={Number(boardId)}
          onClose={() => setIsInviteMembersModalOpen(false)}
        />
      ) : null}
    </>
  );
}

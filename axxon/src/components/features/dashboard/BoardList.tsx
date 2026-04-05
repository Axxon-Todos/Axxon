'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BarChart3, CalendarRange, ChevronDown, FolderKanban, MoreHorizontal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteBoardById } from '@/lib/api/boards/deleteBoardById';
import { fetchBoards } from '@/lib/api/boards/getBoards';
import type { BoardBaseData } from '@/lib/types/boardTypes';
import {
  buildOrganizationBoardAnalyticsPath,
  buildOrganizationBoardPath,
  buildOrganizationBoardSettingsPath,
  buildOrganizationBoardSprintsPath,
} from '@/lib/utils/routes';

import BoardOptionsModal from '@/components/features/dashboard/BoardOptionsModal';
import EditBoardModal from '@/components/features/dashboard/EditBoardModal';
import InviteMembersModal from '@/components/features/dashboard/InviteMembersModal';

interface BoardListProps {
  organizationId: string;
  variant?: 'default' | 'sidebar';
}

const ITEM_EASE = [0.16, 1, 0.3, 1] as const;

export default function BoardList({
  organizationId,
  variant = 'default',
}: BoardListProps) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [editingBoard, setEditingBoard] = useState<BoardBaseData | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<BoardBaseData | null>(null);
  const [inviteBoard, setInviteBoard] = useState<BoardBaseData | null>(null);
  const [expandedBoards, setExpandedBoards] = useState<Record<string, boolean>>({});
  const isSidebar = variant === 'sidebar';

  const { data: boards = [], error, isLoading } = useQuery<BoardBaseData[]>({
    queryKey: ['boards', organizationId],
    queryFn: () => fetchBoards(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (boardId: string) => deleteBoardById(organizationId, boardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId] });
    },
  });

  useEffect(() => {
    const activeBoard = boards.find((board) => {
      const boardHref = buildOrganizationBoardPath(organizationId, board.id);
      return pathname === boardHref || pathname.startsWith(`${boardHref}/`);
    });

    if (!activeBoard) {
      return;
    }

    setExpandedBoards((prev) => {
      const boardId = String(activeBoard.id);

      if (Object.prototype.hasOwnProperty.call(prev, boardId)) {
        return prev;
      }

      return {
        ...prev,
        [boardId]: true,
      };
    });
  }, [boards, organizationId, pathname]);

  const itemTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: ITEM_EASE };

  const statusClassName = clsx(
    'text-sm',
    isSidebar
      ? 'glass-panel rounded-2xl px-4 py-3 app-text-muted'
      : 'glass-panel rounded-2xl px-4 py-3 text-center app-text-muted'
  );

  if (!organizationId) {
    return <div className={statusClassName}>Select an organization to view boards.</div>;
  }

  if (isLoading) {
    return <div className={statusClassName}>Loading boards...</div>;
  }

  if (error) {
    return <div className={statusClassName}>Error loading boards.</div>;
  }

  if (boards.length === 0) {
    return (
      <div className={statusClassName}>
        <p>No boards yet. Create the first control surface for this organization.</p>
      </div>
    );
  }

  return (
    <>
      <div
        className={clsx(
          'space-y-2',
          isSidebar ? 'w-full' : 'w-full overflow-y-auto p-3'
        )}
      >
        {!isSidebar ? (
          <h2 className="mb-6 text-center text-4xl font-bold">Boards</h2>
        ) : null}

        {isSidebar ? (
          <div className="space-y-2">
            {boards.map((board, index) => {
              const boardName = board.name || 'Untitled Board';
              const boardId = String(board.id);
              const overviewHref = buildOrganizationBoardPath(organizationId, board.id);
              const sprintsHref = buildOrganizationBoardSprintsPath(organizationId, board.id);
              const analyticsHref = buildOrganizationBoardAnalyticsPath(organizationId, board.id);
              const isBoardActive =
                pathname === overviewHref || pathname.startsWith(`${overviewHref}/`);
              const isExpanded = expandedBoards[boardId] ?? isBoardActive;
              const isOverviewActive = pathname === overviewHref;
              const isSprintsActive = pathname === sprintsHref;
              const isAnalyticsActive = pathname === analyticsHref;

              return (
                <motion.div
                  key={board.id}
                  initial={
                    shouldReduceMotion
                      ? false
                      : { opacity: 0, y: 10, scale: 0.985 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    ...itemTransition,
                    delay: shouldReduceMotion ? 0 : index * 0.04,
                  }}
                  className="group glass-panel overflow-hidden rounded-[1.6rem] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5"
                  style={
                    isBoardActive
                      ? {
                          borderColor:
                            'color-mix(in srgb, var(--app-accent) 28%, var(--app-border))',
                          background:
                            'color-mix(in srgb, var(--app-accent) 12%, var(--app-panel-strong))',
                          boxShadow:
                            '0 18px 30px -26px color-mix(in srgb, var(--app-accent) 55%, transparent)',
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2 p-2">
                    <Link
                      href={overviewHref}
                      aria-label={`Open ${boardName}`}
                      aria-current={isOverviewActive ? 'page' : undefined}
                      className={clsx(
                        'flex min-w-0 flex-1 items-center gap-3 rounded-[1.2rem] px-3 py-3 transition-[background-color,transform]',
                        isOverviewActive && 'bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]'
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: board.color || '#94a3b8',
                          boxShadow: `0 0 0 6px color-mix(in srgb, ${board.color || '#94a3b8'} 18%, transparent)`,
                        }}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{boardName}</span>
                        <span className="mt-1 block text-xs app-text-muted">Board workspace</span>
                      </span>
                    </Link>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedBoards((prev) => ({
                          ...prev,
                          [boardId]: !(prev[boardId] ?? false),
                        }))
                      }
                      className="glass-button !h-10 !w-10 !p-0"
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${boardName}`}
                    >
                      <motion.span
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={itemTransition}
                        className="flex items-center justify-center"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </motion.span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedBoard(board)}
                      className="glass-button !h-10 !w-10 !p-0"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open options for {boardName}</span>
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {isExpanded ? (
                      <motion.div
                        key={`board-links-${board.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={itemTransition}
                        className="overflow-hidden"
                      >
                        <div className="px-2 pb-3">
                          <div className="ml-4 space-y-1 border-l border-[var(--app-border)] pl-4">
                            <SidebarBoardLink
                              href={overviewHref}
                              label="Overview"
                              active={isOverviewActive}
                              icon={<FolderKanban className="h-4 w-4" />}
                            />
                            <SidebarBoardLink
                              href={sprintsHref}
                              label="Sprints"
                              active={isSprintsActive}
                              icon={<CalendarRange className="h-4 w-4" />}
                            />
                            <SidebarBoardLink
                              href={analyticsHref}
                              label="Analytics"
                              active={isAnalyticsActive}
                              icon={<BarChart3 className="h-4 w-4" />}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {boards.map((board, index) => (
              <motion.article
                key={board.id}
                initial={
                  shouldReduceMotion
                    ? false
                    : { opacity: 0, y: 14, scale: 0.985 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  ...itemTransition,
                  delay: shouldReduceMotion ? 0 : index * 0.04,
                }}
                className="group glass-panel relative rounded-[1.8rem] p-5"
              >
                <Link
                  href={buildOrganizationBoardPath(organizationId, board.id)}
                  className="absolute inset-0 rounded-[1.8rem]"
                />
                <div className="pointer-events-none relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: board.color || '#2563eb' }}
                      />
                      <span className="truncate text-lg font-semibold">
                        {board.name || 'Untitled Board'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm app-text-muted">
                      Execution layer for scoped work inside this organization.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedBoard(board)}
                    className="pointer-events-auto relative z-10 glass-button !h-10 !w-10 !p-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>

      {editingBoard ? (
        <EditBoardModal
          board={editingBoard}
          onClose={() => setEditingBoard(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['boards', organizationId] });
            setEditingBoard(null);
          }}
        />
      ) : null}

      {selectedBoard ? (
        <BoardOptionsModal
          board={selectedBoard}
          onClose={() => setSelectedBoard(null)}
          onEdit={() => setEditingBoard(selectedBoard)}
          onDelete={() => deleteMutation.mutate(String(selectedBoard.id))}
          onSettings={() => {
            router.push(
              buildOrganizationBoardSettingsPath(organizationId, selectedBoard.id)
            );
          }}
          onInvite={() => setInviteBoard(selectedBoard)}
        />
      ) : null}

      {inviteBoard ? (
        <InviteMembersModal
          boardId={Number(inviteBoard.id)}
          organizationId={inviteBoard.organization_id}
          onClose={() => setInviteBoard(null)}
        />
      ) : null}
    </>
  );
}

function SidebarBoardLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-sm transition-[background-color,color]',
        active
          ? 'bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] text-[var(--app-foreground)]'
          : 'app-text-muted hover:bg-[color-mix(in_srgb,var(--app-panel-strong)_84%,transparent)] hover:text-[var(--app-foreground)]'
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

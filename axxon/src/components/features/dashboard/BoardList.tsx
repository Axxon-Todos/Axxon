'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchBoards } from '@/lib/api/boards/getBoards';
import { deleteBoardById } from '@/lib/api/boards/deleteBoardById';
import {
  buildOrganizationBoardPath,
  buildOrganizationBoardSettingsPath,
} from '@/lib/utils/routes';

import BoardOptionsModal from '@/components/features/dashboard/BoardOptionsModal';
import EditBoardModal from '@/components/features/dashboard/EditBoardModal';
import InviteMembersModal from '@/components/features/dashboard/InviteMembersModal';

import type { UpdateBoard } from '@/lib/types/boardTypes';

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
  const [editingBoard, setEditingBoard] = useState<(UpdateBoard & { organization_id: number }) | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<(UpdateBoard & { organization_id: number }) | null>(null);
  const [inviteBoard, setInviteBoard] = useState<{ id: number; organization_id: number } | null>(null);
  const isSidebar = variant === 'sidebar';

  const { data: boards = [], error, isLoading } = useQuery({
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
            {boards.map((board: any, index) => {
              const href = buildOrganizationBoardPath(organizationId, board.id);
              const isActive = pathname === href;

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
                  className="group glass-panel relative rounded-2xl"
                  style={
                    isActive
                      ? {
                          borderColor:
                            'color-mix(in srgb, var(--app-accent) 28%, var(--app-border))',
                          background:
                            'color-mix(in srgb, var(--app-accent) 12%, var(--app-panel-strong))',
                        }
                      : undefined
                  }
                >
                  <Link href={href} className="absolute inset-0 rounded-2xl" />
                  <div className="pointer-events-none relative flex items-center gap-3 px-3 py-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: board.color || '#94a3b8' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {board.name || 'Untitled Board'}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedBoard(board)}
                      className="pointer-events-auto relative z-10 translate-x-1 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                    >
                      <span className="glass-button !h-8 !w-8 !p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {boards.map((board: any, index) => (
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
          onInvite={() =>
            setInviteBoard({
              id: Number(selectedBoard.id),
              organization_id: selectedBoard.organization_id,
            })
          }
        />
      ) : null}

      {inviteBoard ? (
        <InviteMembersModal
          boardId={inviteBoard.id}
          organizationId={inviteBoard.organization_id}
          onClose={() => setInviteBoard(null)}
        />
      ) : null}
    </>
  );
}

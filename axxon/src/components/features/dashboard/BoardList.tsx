'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MoreHorizontal } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { getUserId } from '@/lib/api/users/getUserId'
import { fetchBoards } from '@/lib/api/boards/getBoards'
import { deleteBoardById } from '@/lib/api/boards/deleteBoardById'

import BoardOptionsModal from '@/components/features/dashboard/BoardOptionsModal'
import InviteMembersModal from '@/components/features/dashboard/InviteMembersModal'
import EditBoardModal from '@/components/features/dashboard/EditBoardModal'

import type { UpdateBoard } from '@/lib/types/boardTypes'

interface BoardListProps {
  variant?: 'default' | 'sidebar'
}

const ITEM_EASE = [0.16, 1, 0.3, 1] as const

export default function BoardList({ variant = 'default' }: BoardListProps) {
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const shouldReduceMotion = useReducedMotion()
  const [editingBoard, setEditingBoard] = useState<UpdateBoard | null>(null)
  const [selectedBoard, setSelectedBoard] = useState<UpdateBoard | null>(null)
  const [inviteBoard, setInviteBoard] = useState<UpdateBoard | null>(null)
  const isSidebar = variant === 'sidebar'

  const { data: id, error: userError, isLoading: isUserLoading } = useQuery({
    queryKey: ['id'],
    queryFn: getUserId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: boards = [], error: boardsError, isLoading: isBoardsLoading } = useQuery({
    queryKey: ['boards', id],
    queryFn: () => fetchBoards(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: (boardId: string) => deleteBoardById(boardId),
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: ['boards', id] })
    },
  })

  const itemTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: ITEM_EASE }

  const statusClassName = clsx(
    'text-sm',
    isSidebar
      ? 'glass-panel rounded-2xl px-4 py-3 app-text-muted'
      : 'glass-panel rounded-2xl px-4 py-3 text-center app-text-muted'
  )

  if (isUserLoading || isBoardsLoading) {
    return <div className={statusClassName}>Loading dashboard...</div>
  }

  if (userError) {
    return <div className={statusClassName}>Error loading user info</div>
  }

  if (boardsError) {
    return <div className={statusClassName}>Error loading boards</div>
  }

  if (!id) {
    return <div className={statusClassName}>Please log in to view your dashboard.</div>
  }

  function openBoardOptions(board: UpdateBoard) {
    setSelectedBoard(board)
  }

  return (
    <>
      <div
        className={clsx(
          'space-y-2',
          isSidebar ? 'w-full' : 'w-full overflow-y-auto p-3'
        )}
      >
        {!isSidebar && <h1 className="mb-6 text-center text-4xl font-bold">Boards</h1>}

        {boards.length === 0 ? (
          <p className={statusClassName}>No boards yet.</p>
        ) : isSidebar ? (
          <div className="space-y-2">
            {boards.map((board, index) => {
              const boardName = board.name || 'Untitled Board'
              const href = `/dashboard/${board.id}`
              const isActive = pathname === href

              return (
                <motion.div
                  key={board.id}
                  initial={{
                    opacity: 0,
                    y: shouldReduceMotion ? 0 : 10,
                    scale: shouldReduceMotion ? 1 : 0.985,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  transition={{
                    ...itemTransition,
                    delay: shouldReduceMotion ? 0 : index * 0.045,
                  }}
                  className={clsx(
                    'group glass-panel relative rounded-2xl transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5'
                  )}
                  style={
                    isActive
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
                  <Link
                    href={href}
                    aria-label={`Open ${boardName}`}
                    aria-current={isActive ? 'page' : undefined}
                    className="absolute inset-0 rounded-2xl focus-visible:outline-none"
                  />

                  <div className="pointer-events-none relative flex items-center gap-3 px-3 py-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: board.color || '#94a3b8',
                        boxShadow: `0 0 0 6px color-mix(in srgb, ${board.color || '#94a3b8'} 18%, transparent)`,
                      }}
                    />

                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {boardName}
                    </span>

                    <button
                      type="button"
                      onClick={() => openBoardOptions(board)}
                      className="pointer-events-auto relative z-10 translate-x-1 opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100 focus-visible:translate-x-0 focus-visible:opacity-100"
                    >
                      <span className="glass-button !h-8 !w-8 !p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                      <span className="sr-only">Open options for {boardName}</span>
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="h-[30%] overflow-y-auto pr-2 scrollbar-hidden space-y-3">
            {boards.map((board, index) => {
              const boardName = board.name || 'Untitled Board'

              return (
                <motion.div
                  key={board.id}
                  initial={{
                    opacity: 0,
                    y: shouldReduceMotion ? 0 : 12,
                    scale: shouldReduceMotion ? 1 : 0.985,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  transition={{
                    ...itemTransition,
                    delay: shouldReduceMotion ? 0 : index * 0.05,
                  }}
                  className="group glass-panel relative rounded-[1.5rem] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5"
                >
                  <Link
                    href={`/dashboard/${board.id}`}
                    aria-label={`Open ${boardName}`}
                    className="absolute inset-0 rounded-[1.5rem] focus-visible:outline-none"
                  />

                  <div className="pointer-events-none relative flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: board.color || '#2563eb',
                            boxShadow: `0 0 0 6px color-mix(in srgb, ${board.color || '#2563eb'} 18%, transparent)`,
                          }}
                        />
                        <span className="block truncate text-lg font-semibold">
                          {boardName}
                        </span>
                      </div>
                      <p className="mt-1 text-sm app-text-muted">Board workspace</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openBoardOptions(board)}
                      className="pointer-events-auto relative z-10 glass-button !h-10 !w-10 !p-0"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open options for {boardName}</span>
                    </button>
                  </div>

                  <div className="pointer-events-none px-4 pb-4">
                    <div className="h-2 rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: '42%',
                          backgroundColor: board.color || '#2563eb',
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {editingBoard && (
        <EditBoardModal
          board={editingBoard}
          onClose={() => setEditingBoard(null)}
          onSuccess={() => {
            if (id) queryClient.invalidateQueries({ queryKey: ['boards', id] })
            setEditingBoard(null)
          }}
        />
      )}

      {selectedBoard && (
        <BoardOptionsModal
          board={selectedBoard}
          onClose={() => setSelectedBoard(null)}
          onEdit={() => setEditingBoard(selectedBoard)}
          onDelete={() => deleteMutation.mutate(String(selectedBoard.id))}
          onInvite={() => setInviteBoard(selectedBoard)}
        />
      )}

      {inviteBoard && (
        <InviteMembersModal
          boardId={Number(inviteBoard.id)}
          onClose={() => setInviteBoard(null)}
        />
      )}
    </>
  )
}

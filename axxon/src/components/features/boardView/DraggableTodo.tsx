'use client'

import dayjs from 'dayjs'
import { useDraggable } from '@dnd-kit/core'
import { useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Clock3, UserRound } from 'lucide-react'

import { useBoardView } from '@/context/BoardViewContext'
import { useLabelPopup } from '@/context/LabelPopupManager'
import { fetchLabels } from '@/lib/api/labels/getLabels'
import { useToggleTodoLabel } from '@/lib/mutations/useToggleTodoLabel'
import { useCreateLabel } from '@/lib/mutations/useCreateLabel'

import type { TodoWithLabels } from '@/lib/types/todoTypes'

import LabelIcon from './LabelIcon'
import LabelPopup from './LabelPopup'
import LabelSelector from './LabelSelector'

const priorityMap: Record<number, { label: string; color: string }> = {
  1: { label: 'None', color: '#94a3b8' },
  2: { label: 'Low', color: '#22c55e' },
  3: { label: 'Medium', color: '#f59e0b' },
  4: { label: 'High', color: '#ef4444' },
}

export default function DraggableTodo({
  todo,
  onClick,
}: {
  todo: TodoWithLabels
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: todo.id,
    data: { todo },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  const { hideTodos } = useBoardView()
  const { openPopup, closePopup, isPopupOpen } = useLabelPopup()

  const dragStartRef = useRef<{ x: number; y: number; target: HTMLElement } | null>(null)
  const clickTimeout = useRef<NodeJS.Timeout | null>(null)
  const labelIconRef = useRef<HTMLDivElement>(null)

  const { data: allLabels } = useQuery({
    queryKey: ['labels', String(todo.board_id)],
    queryFn: () => fetchLabels(String(todo.board_id)),
  })

  const toggleLabel = useToggleTodoLabel(String(todo.board_id))
  const createLabel = useCreateLabel(String(todo.board_id))

  useEffect(() => {
    return () => {
      if (isPopupOpen(todo.id)) {
        closePopup()
      }
    }
  }, [closePopup, isPopupOpen, todo.id])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      target: e.target as HTMLElement,
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return

    const clickedElement = dragStartRef.current.target
    const labelIconElement = labelIconRef.current

    if (labelIconElement && labelIconElement.contains(clickedElement)) {
      dragStartRef.current = null
      return
    }

    if (isPopupOpen(todo.id)) {
      dragStartRef.current = null
      return
    }

    const dx = Math.abs(e.clientX - dragStartRef.current.x)
    const dy = Math.abs(e.clientY - dragStartRef.current.y)

    const isClick = dx < 5 && dy < 5
    if (isClick) clickTimeout.current = setTimeout(onClick, 0)

    dragStartRef.current = null
  }

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (labelIconRef.current) {
      openPopup(todo.id, labelIconRef.current)
    }
  }

  const handleToggleLabel = (labelId: number, isAdding: boolean) => {
    toggleLabel.mutate({ todoId: todo.id, labelId, isAdding })
  }

  const handleCreateLabel = (name: string) => {
    createLabel.mutate(
      { name },
      {
        onSuccess: (newLabel) => {
          toggleLabel.mutate({ todoId: todo.id, labelId: newLabel.id, isAdding: true })
        },
      }
    )
  }

  const priority = priorityMap[todo.priority || 1]
  const dueDate = todo.due_date ? dayjs(todo.due_date) : null
  const isOverdue = Boolean(dueDate && !todo.is_complete && dueDate.isBefore(dayjs(), 'day'))

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={`${hideTodos ? 'hidden' : 'glass-panel cursor-grab rounded-[1.35rem] p-4 hover:-translate-y-0.5 active:cursor-grabbing'}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold">{todo.title}</h3>
              {todo.is_complete && <span className="app-badge">Complete</span>}
              {isOverdue && <span className="app-badge text-rose-400">Overdue</span>}
            </div>
            {todo.description && (
              <p className="mt-2 line-clamp-2 text-sm leading-6 app-text-muted">{todo.description}</p>
            )}
          </div>

          <div
            ref={labelIconRef}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="self-start"
          >
            <LabelIcon labels={todo.labels || []} onClick={handleLabelClick} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="app-badge" style={{ color: priority.color }}>
            <AlertCircle className="h-3.5 w-3.5" />
            {priority.label} priority
          </span>
          {dueDate && (
            <span className="app-badge" style={isOverdue ? { color: '#f87171' } : undefined}>
              <Clock3 className="h-3.5 w-3.5" />
              {dueDate.format('MMM D')}
            </span>
          )}
          {todo.assignee_id && (
            <span className="app-badge">
              <UserRound className="h-3.5 w-3.5" />
              Assignee #{todo.assignee_id}
            </span>
          )}
        </div>

        {isPopupOpen(todo.id) && (
          <LabelPopup
            isOpen={isPopupOpen(todo.id)}
            onClose={closePopup}
            anchorRef={labelIconRef}
          >
            <LabelSelector
              boardId={String(todo.board_id)}
              todoId={todo.id}
              currentLabels={todo.labels || []}
              allLabels={Array.isArray(allLabels) ? allLabels : []}
              onToggleLabel={handleToggleLabel}
              onCreateLabel={handleCreateLabel}
            />
          </LabelPopup>
        )}
      </div>
    </article>
  )
}

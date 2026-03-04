'use client'

import { useDraggable } from '@dnd-kit/core'
import { useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useBoardView } from '@/context/BoardViewContext'
import { useLabelPopup } from '@/context/LabelPopupManager'
import { fetchLabels } from '@/lib/api/labels/getLabels'
import { useToggleTodoLabel } from '@/lib/mutations/useToggleTodoLabel'
import { useCreateLabel } from '@/lib/mutations/useCreateLabel'

import type { TodoWithLabels } from '@/lib/types/todoTypes'

import LabelIcon from './LabelIcon'
import LabelPopup from './LabelPopup'
import LabelSelector from './LabelSelector'
import TodoCard from './TodoCard'

export default function DraggableTodo({
  todo,
  onClick,
}: {
  todo: TodoWithLabels
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
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

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={`${hideTodos ? 'hidden' : 'cursor-grab hover:-translate-y-0.5 active:cursor-grabbing'}`}
    >
      <TodoCard
        todo={todo}
        isDragging={isDragging}
        labelControl={
          <div
            ref={labelIconRef}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <LabelIcon labels={todo.labels || []} onClick={handleLabelClick} />
          </div>
        }
      />

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
    </article>
  )
}

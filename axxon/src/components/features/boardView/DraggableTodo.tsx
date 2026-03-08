'use client'

import { useDraggable } from '@dnd-kit/core'
import { useEffect, useRef } from 'react'
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
      onClick={onClick}
      className={`${hideTodos ? 'hidden' : 'cursor-grab hover:-translate-y-0.5 active:cursor-grabbing'} ${
        isDragging ? 'opacity-0 pointer-events-none' : ''
      }`}
    >
      <TodoCard
        todo={todo}
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
        <LabelPopup isOpen={isPopupOpen(todo.id)} onClose={closePopup} anchorRef={labelIconRef}>
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

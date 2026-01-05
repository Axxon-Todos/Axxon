'use client'

import { useDraggable } from '@dnd-kit/core'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TodoWithLabels } from '@/lib/types/todoTypes'
import { useBoardView } from '@/context/BoardViewContext'
import { useLabelPopup } from '@/context/LabelPopupManager'
import { fetchLabels } from '@/lib/api/labels/getLabels'
import { useToggleTodoLabel } from '@/lib/mutations/useToggleTodoLabel'
import { useCreateLabel } from '@/lib/mutations/useCreateLabel'
import LabelIcon from './LabelIcon'
import LabelPopup from './LabelPopup'
import LabelSelector from './LabelSelector'

export default function DraggableTodo({
  todo,
  onClick,
}: {
  todo: TodoWithLabels
  onClick: () => void
}) {

    // Initialize draggable hook for this todo item
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: todo.id,
        data: { todo },
    })

    // Apply transform styles for dragging
    const style = transform
        ? {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        }
        : undefined

  const { hideTodos } = useBoardView();

  // Use global popup context instead of local state to prevent multiple popups
  const { openPopup, closePopup, isPopupOpen } = useLabelPopup()

  // Track drag status
  const dragStartRef = useRef<{ x: number; y: number; target: HTMLElement } | null>(null)
  const clickTimeout = useRef<NodeJS.Timeout | null>(null)

  // Label popup anchor reference
  const labelIconRef = useRef<HTMLDivElement>(null)

  // Fetch all board labels
  const { data: allLabels } = useQuery({
    queryKey: ['labels', String(todo.board_id)],
    queryFn: () => fetchLabels(String(todo.board_id))
  })

  // Mutations
  const toggleLabel = useToggleTodoLabel(String(todo.board_id))
  const createLabel = useCreateLabel(String(todo.board_id))

  // Cleanup: close popup if this todo is unmounting and its popup is open
  useEffect(() => {
    return () => {
      if (isPopupOpen(todo.id)) {
        closePopup()
      }
    }
  }, [])

  // gets starting pointer position when mouse is pressed
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      target: e.target as HTMLElement
    }
  }

  // determines if mouseup is a click or drag based on distance moved
  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return

    // Check if click originated from label icon or its children
    const clickedElement = dragStartRef.current.target
    const labelIconElement = labelIconRef.current

    if (labelIconElement && labelIconElement.contains(clickedElement)) {
      dragStartRef.current = null
      return // Don't trigger todo edit form
    }

    // Don't trigger modal if the label popup is currently open
    if (isPopupOpen(todo.id)) {
      dragStartRef.current = null
      return
    }

    const dx = Math.abs(e.clientX - dragStartRef.current.x)
    const dy = Math.abs(e.clientY - dragStartRef.current.y)

    // Only treat as a click if pointer moved less than threshold
    const isClick = dx < 5 && dy < 5
    if (isClick) clickTimeout.current = setTimeout(onClick, 0)

    dragStartRef.current = null
  }

  // Handlers for label actions
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
    createLabel.mutate({ name }, {
      onSuccess: (newLabel) => {
        toggleLabel.mutate({ todoId: todo.id, labelId: newLabel.id, isAdding: true })
      }
    })
  }

  return (
    <div
      ref={setNodeRef} // Required ref for draggable functionality
      {...listeners} // Draggable event listeners
      {...attributes} // Accessibility and other ARIA attributes
      style={style}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={`${hideTodos ? 'hidden' : 'p-3 border rounded mb-3 bg-gray-50 hover:bg-gray-100 cursor-pointer'}`}
    >
      <div className="flex flex-col sm:flex-row sm:justify-between mb-2">
        <p className="font-semibold">{todo.title}</p>
        <p className="text-sm text-gray-700">{todo.description}</p>
        <p className="text-sm text-gray-500">Assignee ID: {todo.assignee_id}</p>
        <p className="text-sm text-gray-500">Priority: {todo.priority}</p>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div
          ref={labelIconRef}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <LabelIcon
            labels={todo.labels || []}
            onClick={handleLabelClick}
          />
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
    </div>
  )
}

'use client'

import { DragOverlay } from '@dnd-kit/core'
import { createPortal } from 'react-dom'

import type { TodoWithLabels } from '@/lib/types/todoTypes'

import TodoCard from './TodoCard'

interface TodoDragOverlayProps {
  todo: TodoWithLabels | null
  width?: number | null
}

export default function TodoDragOverlay({ todo, width }: TodoDragOverlayProps) {
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <DragOverlay zIndex={80}>
      {todo ? (
        <div className="cursor-grabbing" style={width ? { width } : undefined}>
          <TodoCard todo={todo} elevated />
        </div>
      ) : null}
    </DragOverlay>,
    document.body
  )
}

'use client'

import { useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useModal } from '@/context/ModalManager'

import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import type { TodoWithLabels } from '@/lib/types/todoTypes'

import DroppableColumn from './DroppableColumn'

export default function DraggableCategory({
  category,
  todoCount,
  onTodoClick,
}: {
  category: CategoryBaseData
  todoCount: number
  onTodoClick: (todo: TodoWithLabels) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const { openModal } = useModal()
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const clickTimeout = useRef<NodeJS.Timeout | null>(null)

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return

    const dx = Math.abs(e.clientX - dragStartRef.current.x)
    const dy = Math.abs(e.clientY - dragStartRef.current.y)

    const isClick = dx < 5 && dy < 5
    if (isClick) {
      clickTimeout.current = setTimeout(() => openModal('CATEGORY', category), 0)
    }

    dragStartRef.current = null
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <DroppableColumn
        categoryId={category.id}
        categoryName={category.name}
        categoryColor={category.color}
        isDone={Boolean(category.is_done)}
        todoCount={todoCount}
        todos={[]}
        onTodoClick={onTodoClick}
        managementMode
      />
    </div>
  )
}

'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DroppableColumn from './DroppableColumn'
import { TodoWithLabels } from '@/lib/types/todoTypes'

// A draggable category component that wraps a DroppableColumn
// Used to reorder categories in board view
export default function DraggableCategory({
  category,
  onTodoClick,
}: {
  category: any
  onTodoClick: (todo: TodoWithLabels) => void 
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DroppableColumn
        categoryId={category.id}
        categoryName={category.name}
        todos={category.todos || []}
        onTodoClick={onTodoClick}
      />
    </div>
  )
}

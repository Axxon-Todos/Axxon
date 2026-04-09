// Renders the kanban board view with lane drag-and-drop, category management, and lane-level task creation.
'use client'

import { DndContext, PointerSensor, closestCenter, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragCancelEvent, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Save } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useModal } from '@/context/ModalManager'
import { useMemo, useState } from 'react'

import BoardViewContext from '@/context/BoardViewContext'
import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import type { TodoWithLabels } from '@/lib/types/todoTypes'

import CreateTaskLaneButton from '../CreateTaskLaneButton'
import DraggableTodo from '../DraggableTodo'
import TodoDragOverlay from '../TodoDragOverlay'

export default function BoardKanbanView({
  boardColor,
  categoryOrder,
  categoryMap,
  categorizedTodos,
  isManagingCategories,
  onTodoClick,
  onTodoMove,
  onStageCategoryOrder,
  onSaveCategoryChanges,
  hasUnsavedCategoryChanges,
  canAddTodo,
  onCreateTodo,
}: {
  boardColor: string
  categoryOrder: number[]
  categoryMap: Record<number, CategoryBaseData>
  categorizedTodos: Record<number, TodoWithLabels[]>
  isManagingCategories: boolean
  onTodoClick: (todo: TodoWithLabels) => void
  onTodoMove: (todo: TodoWithLabels, categoryId: number) => void
  onStageCategoryOrder: (order: number[]) => void
  onSaveCategoryChanges: () => Promise<void>
  hasUnsavedCategoryChanges: boolean
  canAddTodo: boolean
  onCreateTodo: (categoryId: number) => void
}) {
  const [activeTodo, setActiveTodo] = useState<TodoWithLabels | null>(null)
  const [activeTodoWidth, setActiveTodoWidth] = useState<number | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  const orderedCategories = useMemo(
    () =>
      categoryOrder
        .map((id) => categoryMap[id])
        .filter((category): category is CategoryBaseData => Boolean(category)),
    [categoryMap, categoryOrder]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const todo = event.active.data.current?.todo as TodoWithLabels | undefined
    setActiveTodo(todo ?? null)
    setActiveTodoWidth(event.active.rect.current.initial?.width ?? null)
  }

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeIndex = categoryOrder.indexOf(Number(active.id))
    const overIndex = categoryOrder.indexOf(Number(over.id))
    if (activeIndex === -1 || overIndex === -1) return

    onStageCategoryOrder(arrayMove(categoryOrder, activeIndex, overIndex))
    setActiveTodo(null)
    setActiveTodoWidth(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const todo = activeTodo
    const overCategoryId = Number(event.over?.id)

    if (todo && overCategoryId && overCategoryId !== todo.category_id) {
      onTodoMove(todo, overCategoryId)
    }

    setActiveTodo(null)
    setActiveTodoWidth(null)
  }

  const handleDragCancel = (_event?: DragCancelEvent) => {
    setActiveTodo(null)
    setActiveTodoWidth(null)
  }

  return (
    <BoardViewContext.Provider value={{ hideTodos: false, setHideTodos: () => {} }}>
      <div
        className="app-kanban-layout"
        style={{ ['--kanban-accent' as string]: boardColor } as CSSProperties}
      >
        {isManagingCategories ? (
          <section className="app-kanban-banner">
            <div>
              <p className="app-kicker">Category Management</p>
              <p className="mt-2 text-sm leading-6 app-text-muted">
                Drag lanes horizontally to reorder them, then open any lane to edit its details without leaving
                the board.
              </p>
            </div>
            {hasUnsavedCategoryChanges ? (
              <button onClick={onSaveCategoryChanges} className="glass-button glass-button-primary">
                <Save className="h-4 w-4" />
                Save Changes
              </button>
            ) : null}
          </section>
        ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={isManagingCategories ? undefined : handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={isManagingCategories ? handleCategoryDragEnd : handleDragEnd}
        >
          <div className="app-kanban-scroll">
            <div className="app-kanban-grid">
              {isManagingCategories ? (
                <SortableContext items={categoryOrder} strategy={horizontalListSortingStrategy}>
                  {orderedCategories.map((category) => (
                    <SortableKanbanCategory
                      key={category.id}
                      category={category}
                      boardColor={boardColor}
                      todoCount={categorizedTodos[category.id]?.length ?? 0}
                    />
                  ))}
                </SortableContext>
              ) : (
                orderedCategories.map((category) => (
                  <KanbanColumn
                    key={category.id}
                    category={category}
                    boardColor={boardColor}
                    todos={categorizedTodos[category.id] || []}
                    onTodoClick={onTodoClick}
                    canCreateTodo={canAddTodo}
                    onCreateTodo={onCreateTodo}
                  />
                ))
              )}
            </div>
          </div>

          {!isManagingCategories ? <TodoDragOverlay todo={activeTodo} width={activeTodoWidth} /> : null}
        </DndContext>
      </div>
    </BoardViewContext.Provider>
  )
}

function KanbanColumn({
  category,
  boardColor,
  todos,
  onTodoClick,
  canCreateTodo,
  onCreateTodo,
}: {
  category: CategoryBaseData
  boardColor: string
  todos: TodoWithLabels[]
  onTodoClick: (todo: TodoWithLabels) => void
  canCreateTodo: boolean
  onCreateTodo: (categoryId: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: category.id })
  const laneAccent = category.color || boardColor

  return (
    <section
      ref={setNodeRef}
      className="app-kanban-lane glass-panel group flex shrink-0 flex-col rounded-[1.75rem] p-6"
      data-done={category.is_done ? 'true' : 'false'}
      data-over={isOver ? 'true' : 'false'}
      style={{ ['--lane-accent' as string]: laneAccent } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span
              className="h-4 w-4 rounded-full"
              style={{
                backgroundColor: laneAccent,
                boxShadow: `0 0 0 8px color-mix(in srgb, ${laneAccent} 18%, transparent)`,
              }}
            />
            <h2 className="truncate text-xl font-semibold">{category.name}</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="app-badge">{todos.length} items</span>
            {category.is_done ? <span className="app-badge">Done lane</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {todos.length > 0 ? (
          <>
            {todos.map((todo) => <DraggableTodo key={todo.id} todo={todo} onClick={() => onTodoClick(todo)} />)}
            <CreateTaskLaneButton
              categoryName={category.name}
              disabled={!canCreateTodo}
              disabledMessage="Archived sprints are read-only."
              onClick={() => onCreateTodo(category.id)}
            />
          </>
        ) : (
          <div className="space-y-3">
            <div
              className="rounded-[1.4rem] border border-dashed px-4 py-5 text-sm leading-6 app-text-muted"
              style={{ borderColor: 'var(--app-border)' }}
            >
              Drag a task here or create a fresh one directly in this lane.
            </div>
            <CreateTaskLaneButton
              categoryName={category.name}
              disabled={!canCreateTodo}
              disabledMessage="Archived sprints are read-only."
              onClick={() => onCreateTodo(category.id)}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function SortableKanbanCategory({
  category,
  boardColor,
  todoCount,
}: {
  category: CategoryBaseData
  boardColor: string
  todoCount: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id })
  const { openModal } = useModal()
  const laneAccent = category.color || boardColor
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ['--lane-accent' as string]: laneAccent,
  } as CSSProperties

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      type="button"
      onClick={() => openModal('CATEGORY', category)}
      className="app-kanban-lane app-kanban-lane-action glass-panel flex shrink-0 flex-col rounded-[1.75rem] p-6 text-left"
      data-done={category.is_done ? 'true' : 'false'}
      data-over="false"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span
            className="h-4 w-4 rounded-full"
            style={{
              backgroundColor: laneAccent,
              boxShadow: `0 0 0 8px color-mix(in srgb, ${laneAccent} 18%, transparent)`,
            }}
          />
          <h2 className="truncate text-xl font-semibold">{category.name}</h2>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="app-badge">{todoCount} items</span>
          {category.is_done ? <span className="app-badge">Done lane</span> : null}
          <span className="app-badge">Drag to reorder</span>
        </div>
      </div>

      <div className="mt-5">
        <div
          className="rounded-[1.4rem] border border-dashed p-5 text-sm leading-6 app-text-muted"
          style={{ borderColor: 'var(--app-border)' }}
        >
          Click this lane to edit its name, color, or completion state. Drag the lane to change ordering.
        </div>
      </div>
    </button>
  )
}

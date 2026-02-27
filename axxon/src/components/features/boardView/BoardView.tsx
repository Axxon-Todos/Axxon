'use client'

import dayjs from 'dayjs'
import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DndContext, closestCenter, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CalendarClock, Layers3, ListTodo, Save, Settings2, Tags } from 'lucide-react'

import { useSocket } from '@/hooks/useSocket'
import { useBoardRealtime } from '@/hooks/useBoardRealtime'
import { useUpdateTodoMutation } from '@/lib/mutations/useUpdateTodo'
import { useDeleteTodoMutation } from '@/lib/mutations/useDeleteTodo'
import { useUpdateCategory } from '@/lib/mutations/UseUpdateCategory'
import { useDeleteCategory } from '@/lib/mutations/useDeleteCategory'
import { useReorderCategories } from '@/lib/mutations/useReorderCategories'

import { fetchBoard } from '@/lib/api/boards/getSingleBoard'
import { fetchCategories } from '@/lib/api/categories/getCategories'
import { fetchLabels } from '@/lib/api/labels/getLabels'
import { fetchTodosWithLabels } from '@/lib/api/todos/getTodosWithLabels'

import DroppableColumn from './DroppableColumn'
import DraggableCategory from './DraggableCategory'
import Modal from '@/components/ui/Modal'
import AddTodoForm from '@/components/forms/AddTodoForms'
import UpdateTodoForm from '@/components/forms/UpdateTodoForm'
import UpdateCategoryForm from '@/components/forms/CategoryForm'

import BoardViewContext from '@/context/BoardViewContext'
import { useModal } from '@/context/ModalManager'

import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import type { TodoWithLabels } from '@/lib/types/todoTypes'

export default function BoardView({ boardId }: { boardId: string }) {
  const modalTitleMap = {
    ADD_TODO: 'Add Todo',
    UPDATE_TODO: 'Update Todo',
    CATEGORY: 'Edit Category',
  }

  const socketRef = useSocket(boardId)
  useBoardRealtime(boardId, socketRef)

  const [activeTodo, setActiveTodo] = useState<TodoWithLabels | null>(null)
  const [hideTodos, setHideTodos] = useState(false)
  const [categoryOrder, setCategoryOrder] = useState<number[]>([])
  const [unsavedOrder, setUnsavedOrder] = useState<number[] | null>(null)
  const [unsavedCategories, setUnsavedCategories] = useState<Record<number, Partial<CategoryBaseData>>>({})

  const { modalState, openModal, closeModal } = useModal()

  const updateTodo = useUpdateTodoMutation(boardId)
  const deleteTodo = useDeleteTodoMutation(boardId)
  const reorderCategories = useReorderCategories(boardId)
  const updateCategory = useUpdateCategory(boardId)
  const deleteCategory = useDeleteCategory(boardId)

  const { data: board } = useQuery({ queryKey: ['board', boardId], queryFn: () => fetchBoard(boardId) })
  const { data: categories } = useQuery<CategoryBaseData[]>({
    queryKey: ['categories', boardId],
    queryFn: () => fetchCategories(boardId),
  })
  const { data: labels } = useQuery({
    queryKey: ['labels', boardId],
    queryFn: () => fetchLabels(boardId),
  })
  const { data: todos } = useQuery<TodoWithLabels[]>({
    queryKey: ['todos', boardId],
    queryFn: () => fetchTodosWithLabels(boardId),
  })

  const categoryMap = useMemo(() => {
    if (!categories) return {}
    return categories.reduce((acc, category) => {
      const overrides = unsavedCategories[category.id] || {}
      acc[category.id] = { ...category, ...overrides }
      return acc
    }, {} as Record<number, CategoryBaseData>)
  }, [categories, unsavedCategories])

  useEffect(() => {
    if (categories && categories.length && categoryOrder.length === 0) {
      setCategoryOrder(categories.map((category) => category.id))
    }
  }, [categories, categoryOrder.length])

  const categorizedTodos = useMemo(() => {
    if (!todos || !categories) return {}
    return categories.reduce((acc, category) => {
      acc[category.id] = todos.filter((todo) => todo.category_id === category.id)
      return acc
    }, {} as Record<number, TodoWithLabels[]>)
  }, [todos, categories])

  const dueSoonCount = (todos || []).filter((todo) => {
    if (!todo.due_date || todo.is_complete) return false
    const dueDate = dayjs(todo.due_date)
    return dueDate.isAfter(dayjs().subtract(1, 'day'), 'day') && dueDate.diff(dayjs(), 'day') <= 7
  }).length

  const completedCount = (todos || []).filter((todo) => todo.is_complete).length

  const hasUnsavedCategoryChanges = Boolean(unsavedOrder || Object.keys(unsavedCategories).length > 0)

  const handleDragStart = (event: DragStartEvent) => {
    const todo = event.active.data.current?.todo as TodoWithLabels
    setActiveTodo(todo)
  }

  const handleTodoDragEnd = (event: DragEndEvent) => {
    const todo = activeTodo
    const overCategoryId = Number(event.over?.id)
    if (todo && overCategoryId && overCategoryId !== todo.category_id) {
      updateTodo.mutate({ todoId: todo.id, data: { category_id: overCategoryId } })
    }
    setActiveTodo(null)
  }

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setCategoryOrder((prevOrder) => {
      const activeIndex = prevOrder.indexOf(Number(active.id))
      const overIndex = prevOrder.indexOf(Number(over.id))
      if (activeIndex === -1 || overIndex === -1) return prevOrder

      const newOrder = arrayMove(prevOrder, activeIndex, overIndex)
      setUnsavedOrder(newOrder)
      return newOrder
    })
  }

  const handleSaveCategoryChanges = async () => {
    try {
      const updatePromises = Object.entries(unsavedCategories).map(([id, data]) =>
        updateCategory.mutateAsync({ categoryId: Number(id), data })
      )

      if (unsavedOrder) {
        await reorderCategories.mutateAsync(unsavedOrder.map(String))
      }

      await Promise.all(updatePromises)
      setUnsavedCategories({})
      setUnsavedOrder(null)
    } catch (err) {
      console.error('Failed to save category changes', err)
    }
  }

  const toggleManagementMode = () => {
    setHideTodos((prev) => {
      const newHide = !prev
      if (prev) {
        setUnsavedOrder(null)
        setUnsavedCategories({})
        if (categories) {
          setCategoryOrder(categories.map((category) => category.id))
        }
      }
      return newHide
    })
  }

  if (!board || !categories || !todos || !labels) {
    return (
      <div className="mx-auto max-w-[1380px]">
        <section className="glass-panel-strong rounded-[2rem] p-8">
          <p className="app-kicker">Boardview</p>
          <h1 className="mt-3 text-3xl font-semibold">Loading board...</h1>
        </section>
      </div>
    )
  }

  const renderModalContent = () => {
    if (!modalState.type) return null

    switch (modalState.type) {
      case 'ADD_TODO':
        return <AddTodoForm boardId={Number(boardId)} onClose={closeModal} />
      case 'UPDATE_TODO':
        return modalState.payload ? (
          <UpdateTodoForm
            todo={modalState.payload}
            boardId={boardId}
            onClose={closeModal}
            onDelete={() => {
              deleteTodo.mutate(modalState.payload.id)
              closeModal()
            }}
          />
        ) : null
	      case 'CATEGORY':
	        return modalState.payload ? (
	          <UpdateCategoryForm
	            category={modalState.payload}
	            onSave={(updatedProps: Partial<CategoryBaseData>) => {
	              setUnsavedCategories((prev) => ({
	                ...prev,
	                [modalState.payload.id]: { ...prev[modalState.payload.id], ...updatedProps },
	              }))
	              closeModal()
	            }}
	            onDelete={(id: number) => {
	              setCategoryOrder((prev) => prev.filter((categoryId) => categoryId !== id))
	              setUnsavedCategories((prev) => {
	                const copy = { ...prev }
                delete copy[id]
                return copy
              })
              deleteCategory.mutate(id)
              closeModal()
            }}
            onClose={closeModal}
          />
        ) : null
      default:
        return null
    }
  }

  const accentColor = board.color || '#2563eb'

  return (
    <BoardViewContext.Provider value={{ hideTodos, setHideTodos }}>
      <div className="mx-auto flex max-w-[1380px] flex-col gap-6">
        <section
          className="glass-panel-strong rounded-[2rem] p-6 sm:p-8"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 16%, var(--app-panel-strong)), var(--app-panel-strong))`,
          }}
        >
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="app-kicker">Boardview</p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 0 0 8px color-mix(in srgb, ${accentColor} 18%, transparent)`,
                  }}
                />
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{board.name}</h1>
              </div>
              <p className="mt-4 max-w-2xl text-base leading-7 app-text-muted">
                Manage active work, inspect priority signals, and switch into lane-editing mode without
                leaving the board.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="app-badge">
                  <Layers3 className="h-3.5 w-3.5" />
                  {categories.length} categories
                </span>
                <span className="app-badge">
                  <ListTodo className="h-3.5 w-3.5" />
                  {todos.length} todos
                </span>
                <span className="app-badge">
                  <Tags className="h-3.5 w-3.5" />
                  {labels.length} labels
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => openModal('ADD_TODO')} className="glass-button glass-button-primary">
                <ListTodo className="h-4 w-4" />
                Add Todo
              </button>
              <button onClick={toggleManagementMode} className="glass-button">
                <Settings2 className="h-4 w-4" />
                {hideTodos ? 'Exit Manage Mode' : 'Manage Categories'}
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <BoardMetricCard title="Tracked Todos" value={todos.length} icon={<ListTodo className="h-5 w-5" />} />
            <BoardMetricCard title="Due This Week" value={dueSoonCount} icon={<CalendarClock className="h-5 w-5" />} />
            <BoardMetricCard title="Completed" value={completedCount} icon={<Tags className="h-5 w-5" />} />
          </div>
        </section>

        {hideTodos && (
          <section className="glass-panel flex flex-col gap-4 rounded-[1.75rem] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="app-kicker">Category Management</p>
              <p className="mt-2 text-sm leading-6 app-text-muted">
                Drag categories to reorder them, click a lane to edit its settings, then save the changes when
                you are ready.
              </p>
            </div>
            {hasUnsavedCategoryChanges && (
              <button onClick={handleSaveCategoryChanges} className="glass-button glass-button-primary">
                <Save className="h-4 w-4" />
                Save Changes
              </button>
            )}
          </section>
        )}

        {modalState.type && (
          <Modal
            isOpen={!!modalState.type}
            onClose={closeModal}
            title={modalTitleMap[modalState.type]}
          >
            {renderModalContent()}
          </Modal>
        )}

        <DndContext
          collisionDetection={closestCenter}
          onDragStart={hideTodos ? () => {} : handleDragStart}
          onDragEnd={hideTodos ? handleCategoryDragEnd : handleTodoDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <div className="space-y-5">
            {hideTodos ? (
              <SortableContext items={categoryOrder} strategy={verticalListSortingStrategy}>
                {categoryOrder.map((id) => {
                  const category = categoryMap[id]
                  if (!category) return null
                  return (
                    <DraggableCategory
                      key={category.id}
                      category={category}
                      todoCount={categorizedTodos[category.id]?.length ?? 0}
                      onTodoClick={(todo: TodoWithLabels) => openModal('UPDATE_TODO', todo)}
                    />
                  )
                })}
              </SortableContext>
            ) : (
              categoryOrder.map((id) => {
                const category = categoryMap[id]
                if (!category) return null
                return (
                  <DroppableColumn
                    key={category.id}
                    categoryId={category.id}
                    categoryName={category.name}
                    categoryColor={category.color}
                    isDone={Boolean(category.is_done)}
                    todoCount={categorizedTodos[category.id]?.length ?? 0}
                    todos={categorizedTodos[category.id] || []}
                    onTodoClick={(todo) => openModal('UPDATE_TODO', todo)}
                  />
                )
              })
            )}
          </div>
        </DndContext>
      </div>
    </BoardViewContext.Provider>
  )
}

function BoardMetricCard({
  title,
  value,
  icon,
}: {
  title: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <article className="glass-panel rounded-[1.5rem] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium app-text-muted">{title}</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{value}</p>
        </div>
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--app-accent)]"
          style={{ background: 'color-mix(in srgb, var(--app-accent) 12%, transparent)' }}
        >
          {icon}
        </span>
      </div>
    </article>
  )
}
